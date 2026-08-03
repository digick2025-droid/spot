-- ════════════════════════════════════════════════════════════════════
-- SPOT — Phase 2 : points de fidélité du SPOT PASS
--
-- Les points sont crédités À L'ACHAT du billet (décision produit), donc
-- au moment exact où la commande passe à « paid ». On les écrit dans
-- spot.mark_order_paid, qui est le passage obligé : le SELECT ... FOR
-- UPDATE y sérialise déjà les appels et un rejeu ressort en « return 0 »
-- avant toute écriture. Le crédit hérite donc de cette idempotence sans
-- mécanisme supplémentaire.
--
-- Historique (une ligne par gain) plutôt que compteur sur profiles :
--   • l'utilisateur peut voir d'où viennent ses points ;
--   • le jour où un remboursement existera, il suffira d'ajouter une
--     ligne négative — pas de recalcul d'un compteur déjà dérivé.
-- ════════════════════════════════════════════════════════════════════

-- ── point_entries ───────────────────────────────────────────────────
-- LECTURE SEULE pour le client, comme le reste du tunnel d'achat : un
-- participant ne doit pas pouvoir s'attribuer des points.
create table spot.point_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references spot.profiles (id) on delete cascade,
  order_id    uuid references spot.orders (id) on delete set null,
  points      integer not null,
  reason      text not null check (reason in ('order_paid', 'adjustment')),
  created_at  timestamptz not null default now(),
  -- Une commande ne crédite qu'une fois. Postgres considère les NULL
  -- comme distincts : les ajustements manuels (order_id nul) restent
  -- possibles en nombre quelconque.
  constraint point_entries_order_uniq unique (order_id)
);

create index point_entries_user_id_idx
  on spot.point_entries (user_id, created_at desc);

alter table spot.point_entries enable row level security;

create policy point_entries_select_own on spot.point_entries
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select on spot.point_entries to authenticated;
grant all    on spot.point_entries to service_role;

-- ── Crédit des points à l'émission des billets ──────────────────────
-- Reprise intégrale de la fonction de Phase 1, augmentée du seul bloc
-- « points ». Barème de la maquette : 1 point par tranche de 100 FCFA.
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
  v_points   integer;
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
  end if;

  return v_created;
end;
$$;

revoke execute on function spot.mark_order_paid(uuid) from public;
