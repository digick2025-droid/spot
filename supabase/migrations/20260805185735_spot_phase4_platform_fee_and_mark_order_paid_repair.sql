-- ════════════════════════════════════════════════════════════════════
-- SPOT — Commission de la plateforme, et réparation de mark_order_paid
--
-- Deux choses dans la même migration parce qu'elles vivent au même
-- endroit : la fonction qui transforme une commande payée en billets.
--
-- 1. RÉPARATION. La migration du cadeau (20260805145614) a réécrit
--    mark_order_paid en n'y remettant que l'émission des billets : les
--    points du SPOT PASS et la commission du creator avaient disparu de
--    la nouvelle version. Aucune commande n'a été payée entre-temps —
--    rien à rattraper en données — mais la perte était silencieuse, et
--    c'est ce qui la rend grave : un creator aurait promu sans jamais
--    rien gagner, sans qu'aucune erreur ne le dise.
--
-- 2. COMMISSION PLATEFORME. SPOT prélève un pourcentage sur chaque
--    commande encaissée. Le taux vit dans spot.settings pour que l'admin
--    puisse l'ajuster ; il est FIGÉ dans la ligne de frais au moment de
--    l'encaissement, comme la commission creator. Changer le taux demain
--    ne réécrit donc pas ce que les organisateurs doivent aujourd'hui.
-- ════════════════════════════════════════════════════════════════════

-- ── Réglages de la plateforme ───────────────────────────────────────
-- Une table clé/valeur plutôt qu'une constante dans le code : le taux
-- se règle sans redéploiement, et la valeur appliquée reste lisible.
create table spot.settings (
  key         text primary key,
  value       numeric not null,
  updated_at  timestamptz not null default now()
);

comment on table spot.settings is
  'Réglages numériques de la plateforme. Lisible par tous les comptes connectés : un organisateur a le droit de savoir ce qui lui est prélevé.';

insert into spot.settings (key, value) values
  ('platform_commission_percent', 5);

alter table spot.settings enable row level security;

create policy settings_select_all on spot.settings
  for select to authenticated
  using (true);

-- Écriture réservée à l'admin — et au serveur.
create policy settings_write_admin on spot.settings
  for all to authenticated
  using (spot_private.is_admin())
  with check (spot_private.is_admin());

grant select on spot.settings to authenticated;
grant all    on spot.settings to service_role;

create trigger settings_set_updated_at
  before update on spot.settings
  for each row execute function spot.set_updated_at();

-- ── Frais prélevés, commande par commande ───────────────────────────
-- Une ligne par commande encaissée, jamais recalculée. base_xaf et
-- percent sont conservés à côté du montant : trois ans plus tard, on
-- peut refaire le calcul sans deviner quel taux s'appliquait.
create table spot.platform_fees (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique references spot.orders (id) on delete cascade,
  organizer_id  uuid not null references spot.organizers (id) on delete restrict,
  event_id      uuid not null references spot.events (id) on delete restrict,
  base_xaf      integer not null check (base_xaf >= 0),
  percent       numeric(5,2) not null check (percent >= 0 and percent <= 100),
  amount_xaf    integer not null check (amount_xaf >= 0),
  created_at    timestamptz not null default now()
);

create index platform_fees_organizer_idx on spot.platform_fees (organizer_id, created_at desc);
create index platform_fees_event_idx     on spot.platform_fees (event_id);

alter table spot.platform_fees enable row level security;

-- Lecture pour l'organisateur concerné : c'est sa dette, il doit la voir
-- détaillée. Aucune policy d'écriture — seul mark_order_paid en crée.
create policy platform_fees_select_owner on spot.platform_fees
  for select to authenticated
  using (spot_private.owns_organizer(organizer_id));

create policy platform_fees_select_admin on spot.platform_fees
  for select to authenticated
  using (spot_private.is_admin());

grant select on spot.platform_fees to authenticated;
grant all    on spot.platform_fees to service_role;

-- ── mark_order_paid, au complet ─────────────────────────────────────
-- Ordre des effets : billets, points, commission creator, frais de
-- plateforme. Tout dans la même transaction que le passage à « payée » —
-- une commande payée sans sa commission n'existe pas.
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
  v_is_gift     boolean;
  v_organizer   uuid;
  v_percent     numeric;
  v_fee         integer;
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

  v_is_gift := v_order.gift_recipient_name is not null;

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
        order_id, event_id, ticket_type_id, holder_id, code, secret,
        gift_claim_code, gift_recipient_name, gifted_by
      )
      values (
        p_order_id,
        v_order.event_id,
        v_item.ticket_type_id,
        v_order.user_id,
        upper(encode(extensions.gen_random_bytes(6), 'hex')),
        encode(extensions.gen_random_bytes(32), 'hex'),
        case when v_is_gift
             then encode(extensions.gen_random_bytes(12), 'hex')
             else null end,
        v_order.gift_recipient_name,
        case when v_is_gift then v_order.user_id else null end
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

  -- Frais de la plateforme. Le taux absent vaut zéro plutôt qu'une
  -- erreur : mieux vaut une commande encaissée sans prélèvement qu'un
  -- paiement refusé parce qu'une ligne de réglage manque.
  select e.organizer_id into v_organizer
  from spot.events e
  where e.id = v_order.event_id;

  v_percent := coalesce(
    (select s.value from spot.settings s where s.key = 'platform_commission_percent'),
    0
  );
  v_fee := round(v_order.total_xaf * v_percent / 100.0);

  if v_organizer is not null and v_fee > 0 then
    insert into spot.platform_fees (
      order_id, organizer_id, event_id, base_xaf, percent, amount_xaf
    )
    values (
      p_order_id, v_organizer, v_order.event_id,
      v_order.total_xaf, v_percent, v_fee
    );
  end if;

  return v_created;
end;
$$;

revoke execute on function spot.mark_order_paid(uuid) from public;
