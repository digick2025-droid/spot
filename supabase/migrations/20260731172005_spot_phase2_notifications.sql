-- ════════════════════════════════════════════════════════════════════
-- SPOT — Phase 2 : notifications in-app
--
-- Trois faits valent d'être signalés sans que l'utilisateur ait à
-- revenir vérifier une page : des points crédités, un versement qui
-- part ou qui échoue, un creator qui rejoint une campagne. Dans les
-- trois cas l'écriture se fait dans la même transaction que le fait
-- qu'elle rapporte — mark_order_paid, settle_payout et fail_payout
-- restent le passage obligé, la notification n'est qu'une ligne de
-- plus dans leur travail déjà verrouillé.
--
-- Lecture seule pour le concerné, comme le reste du schéma : seule la
-- colonne « read_at » s'écrit côté client, pour qu'une notification ne
-- puisse ni être fabriquée ni être réattribuée à quelqu'un d'autre.
-- ════════════════════════════════════════════════════════════════════

create type spot.notification_type as enum (
  'points_earned', 'payout_paid', 'payout_failed', 'creator_joined'
);

create table spot.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references spot.profiles (id) on delete cascade,
  type        spot.notification_type not null,
  payload     jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_id_idx
  on spot.notifications (user_id, created_at desc);

alter table spot.notifications enable row level security;

create policy notifications_select_own on spot.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Seule la marque de lecture bouge, et seulement la sienne : le
-- contenu d'une notification ne change jamais après coup.
create policy notifications_update_own on spot.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select on spot.notifications to authenticated;
grant update (read_at) on spot.notifications to authenticated;
grant all on spot.notifications to service_role;

-- ── Points crédités ──────────────────────────────────────────────────
-- Reprise intégrale de mark_order_paid, augmentée de la notification.
create or replace function spot.mark_order_paid(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order       spot.orders;
  v_item        record;
  v_link        record;
  v_i           integer;
  v_created     integer := 0;
  v_points      integer;
  v_commission  integer;
begin
  -- Verrou : tout autre appel sur cette commande attend ici.
  select * into v_order
  from spot.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Commande % introuvable', p_order_id;
  end if;

  -- Déjà traitée : rejeu inoffensif, on ne réémet rien.
  if v_order.status = 'paid' then
    return 0;
  end if;

  if v_order.status not in ('pending', 'failed') then
    raise exception 'Commande % dans l''état % : passage à payée refusé',
      p_order_id, v_order.status;
  end if;

  update spot.orders
     set status = 'paid',
         paid_at = now(),
         failure_note = null
   where id = p_order_id;

  for v_item in
    select * from spot.order_items where order_id = p_order_id
  loop
    -- Décrément du stock. La contrainte ticket_types_not_oversold fait
    -- échouer toute la transaction en cas de survente.
    update spot.ticket_types
       set quantity_sold = quantity_sold + v_item.quantity
     where id = v_item.ticket_type_id;

    for v_i in 1..v_item.quantity loop
      insert into spot.tickets (
        order_id, event_id, ticket_type_id, holder_id, code, secret
      )
      values (
        p_order_id,
        v_order.event_id,
        v_item.ticket_type_id,
        v_order.user_id,
        upper(encode(extensions.gen_random_bytes(6), 'hex')),
        encode(extensions.gen_random_bytes(32), 'hex')
      );
      v_created := v_created + 1;
    end loop;
  end loop;

  -- Points du SPOT PASS. Le 100.0 est délibéré : « / 100 » ferait une
  -- division entière et tronquerait au lieu d'arrondir. Un événement
  -- gratuit ne crée pas de ligne à zéro.
  v_points := round(v_order.total_xaf / 100.0);
  if v_points > 0 then
    insert into spot.point_entries (user_id, order_id, points, reason)
    values (v_order.user_id, p_order_id, v_points, 'order_paid');

    insert into spot.notifications (user_id, type, payload)
    values (
      v_order.user_id, 'points_earned',
      jsonb_build_object('points', v_points, 'order_id', p_order_id)
    );
  end if;

  -- Commission du creator, quand la commande vient d'un lien de
  -- parrainage. Le taux est relu ici, jamais transmis par le client.
  if v_order.creator_link_id is not null then
    select l.id           as link_id,
           l.creator_id   as creator_id,
           c.id           as campaign_id,
           c.commission_kind,
           c.commission_value
      into v_link
      from spot.creator_links l
      join spot.campaigns c on c.id = l.campaign_id
     where l.id = v_order.creator_link_id;

    if found then
      if v_link.commission_kind = 'percent' then
        v_commission := round(
          v_order.total_xaf * v_link.commission_value / 100.0
        );
      else
        -- Montant fixe par billet émis.
        v_commission := v_link.commission_value * v_created;
      end if;

      if v_commission > 0 then
        insert into spot.commissions (
          order_id, creator_link_id, creator_id, campaign_id,
          base_xaf, amount_xaf
        )
        values (
          p_order_id, v_link.link_id, v_link.creator_id, v_link.campaign_id,
          v_order.total_xaf, v_commission
        );
      end if;
    end if;
  end if;

  return v_created;
end;
$$;

revoke execute on function spot.mark_order_paid(uuid) from public;

-- ── Versement confirmé ───────────────────────────────────────────────
create or replace function spot.settle_payout(
  p_payout_id    uuid,
  p_provider_ref text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout spot.payouts;
begin
  select * into v_payout
  from spot.payouts
  where id = p_payout_id
  for update;

  if not found then
    raise exception 'Versement % introuvable', p_payout_id;
  end if;

  -- Rejeu du webhook : inoffensif.
  if v_payout.status = 'paid' then
    return false;
  end if;

  -- Cas tordu : « payé » arrive après un « échoué » qui a déjà remis les
  -- commissions au pot. Les rattacher ici risquerait de payer deux fois
  -- les mêmes francs. On laisse donc le versement en échec et on le
  -- signale, pour arbitrage humain.
  if v_payout.status = 'failed' then
    update spot.payouts
       set failure_note = 'Confirmation « payé » reçue après un échec : à vérifier à la main'
     where id = p_payout_id;
    return false;
  end if;

  update spot.payouts
     set status       = 'paid',
         paid_at      = now(),
         failure_note = null,
         provider_ref = coalesce(p_provider_ref, provider_ref)
   where id = p_payout_id;

  insert into spot.notifications (user_id, type, payload)
  values (
    v_payout.creator_id, 'payout_paid',
    jsonb_build_object(
      'payout_id', p_payout_id,
      'amount_xaf', v_payout.amount_xaf,
      'reference', v_payout.reference
    )
  );

  return true;
end;
$$;

revoke execute on function spot.settle_payout(uuid, text) from public;

-- ── Échec : l'argent n'est pas parti ────────────────────────────────
create or replace function spot.fail_payout(p_payout_id uuid, p_note text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout spot.payouts;
begin
  select * into v_payout
  from spot.payouts
  where id = p_payout_id
  for update;

  if not found then
    raise exception 'Versement % introuvable', p_payout_id;
  end if;

  -- Un versement confirmé ne redevient jamais un échec : un webhook
  -- d'échec en retard ne doit pas rendre dû ce qui a déjà été payé.
  if v_payout.status <> 'pending' then
    return false;
  end if;

  update spot.payouts
     set status = 'failed', failure_note = p_note
   where id = p_payout_id;

  update spot.commissions
     set payout_id = null
   where payout_id = p_payout_id;

  insert into spot.notifications (user_id, type, payload)
  values (
    v_payout.creator_id, 'payout_failed',
    jsonb_build_object(
      'payout_id', p_payout_id,
      'amount_xaf', v_payout.amount_xaf,
      'reference', v_payout.reference,
      'note', p_note
    )
  );

  return true;
end;
$$;

revoke execute on function spot.fail_payout(uuid, text) from public;
