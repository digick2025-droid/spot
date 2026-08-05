-- ════════════════════════════════════════════════════════════════════
-- SPOT — Billet offert.
--
-- Offrir un billet, ce n'est pas payer pour quelqu'un d'autre : c'est
-- acheter un billet qu'on garde jusqu'à ce que la personne le prenne.
-- Le billet naît donc au nom de l'acheteur — il le voit, il peut le
-- renvoyer, il le récupère si personne ne le réclame — et porte un code
-- de réclamation. Qui l'ouvre et le réclame en devient le porteur.
--
-- Aucun e-mail n'est envoyé d'ici : la plateforme n'a pas d'expéditeur
-- transactionnel, et sur ce marché un cadeau se transmet de toute façon
-- par WhatsApp. Le code voyage dans un lien que l'acheteur partage.
-- ════════════════════════════════════════════════════════════════════

alter table spot.orders
  add column if not exists gift_recipient_name text,
  add column if not exists gift_message text;

alter table spot.tickets
  add column if not exists gift_claim_code text,
  add column if not exists gift_recipient_name text,
  add column if not exists gifted_by uuid references spot.profiles (id) on delete set null,
  add column if not exists claimed_at timestamptz;

-- Le code est l'adresse du cadeau : deux billets ne peuvent pas la
-- partager. Les billets ordinaires n'en ont pas, d'où l'index partiel.
create unique index if not exists tickets_gift_claim_code_key
  on spot.tickets (gift_claim_code)
  where gift_claim_code is not null;

-- On ne réclame que ce qui a été offert.
alter table spot.tickets
  drop constraint if exists tickets_claimed_needs_gift;
alter table spot.tickets
  add constraint tickets_claimed_needs_gift
  check (claimed_at is null or gift_claim_code is not null);

-- ── Émission : le cadeau se décide à la commande ────────────────────
-- Même fonction qu'avant, au verrou et à l'idempotence près : seule
-- l'insertion des billets change, pour reporter les champs du cadeau et
-- tirer un code de réclamation par billet (on peut offrir deux places,
-- chacune se réclame séparément).
create or replace function spot.mark_order_paid(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order    spot.orders;
  v_item     record;
  v_i        integer;
  v_created  integer := 0;
  v_is_gift  boolean;
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

  return v_created;
end;
$$;

revoke execute on function spot.mark_order_paid(uuid) from public;

-- ── Réclamation ─────────────────────────────────────────────────────
-- L'identité du réclamant est passée en paramètre plutôt que lue dans
-- auth.uid() : comme tout le tunnel d'achat, l'écriture est faite par le
-- serveur en service_role, après vérification de la session. La fonction
-- n'est exécutable par personne d'autre.
--
-- Le verrou sérialise deux ouvertures simultanées du même lien : la
-- seconde voit le billet déjà réclamé.
create or replace function spot.claim_gift_ticket(
  p_code text,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket spot.tickets;
begin
  select * into v_ticket
  from spot.tickets
  where gift_claim_code = p_code
  for update;

  if not found then
    raise exception 'GIFT_NOT_FOUND';
  end if;

  -- Rejeu du même lien par la même personne : on rend le billet, sans
  -- rien changer. Un lien ouvert deux fois n'est pas une erreur.
  if v_ticket.claimed_at is not null then
    if v_ticket.holder_id = p_user_id then
      return v_ticket.id;
    end if;
    raise exception 'GIFT_ALREADY_CLAIMED';
  end if;

  -- S'offrir à soi-même son propre cadeau ne change rien : le billet est
  -- déjà à son nom. On le referme pour qu'il cesse de circuler.
  if v_ticket.status <> 'valid' then
    raise exception 'GIFT_NOT_VALID';
  end if;

  update spot.tickets
     set holder_id  = p_user_id,
         claimed_at = now()
   where id = v_ticket.id;

  return v_ticket.id;
end;
$$;

revoke execute on function spot.claim_gift_ticket(text, uuid) from public;
