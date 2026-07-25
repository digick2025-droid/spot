-- ════════════════════════════════════════════════════════════════════
-- SPOT — Phase 1 : référentiel de catégories + seed de démo
-- Les 8 catégories sont celles de la maquette (D.cats), dans son ordre.
-- ════════════════════════════════════════════════════════════════════

insert into spot.categories (key, emoji, label_fr, label_en, sort) values
  ('concert',     '🎵', 'Concerts',     'Concerts',   1),
  ('formation',   '🎓', 'Formations',   'Trainings',  2),
  ('business',    '💼', 'Business',     'Business',   3),
  ('culture',     '🎭', 'Culture',      'Culture',    4),
  ('sport',       '⚽', 'Sport',        'Sports',     5),
  ('networking',  '🤝', 'Networking',   'Networking', 6),
  ('religion',    '🙏', 'Religion',     'Religion',   7),
  ('gastronomie', '🍽', 'Gastronomie',  'Food',       8)
on conflict (key) do nothing;

-- ── Seed de démo : les 6 événements de la maquette ──────────────────
-- Idempotent, rattaché à un propriétaire donné. Réservé à service_role
-- (appelé depuis un script de développement, jamais depuis le client).
create or replace function spot.seed_demo_data(p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id     uuid;
  v_event_id   uuid;
  r            record;
begin
  if not exists (select 1 from spot.profiles where id = p_owner_id) then
    raise exception 'Profil % introuvable : connecte-toi d''abord dans SPOT', p_owner_id;
  end if;

  -- Organisateurs (le nom « org » de la maquette fait foi)
  for r in
    select * from (values
      ('Festival Afro',      'festival-afro',      '🎤', 'linear-gradient(135deg,#FF6B35,#C2410C)'),
      ('ActivSpaces',        'activspaces',        '🚀', 'linear-gradient(135deg,#8B5CF6,#4C1D95)'),
      ('Canal Comedy Club',  'canal-comedy-club',  '🎭', 'linear-gradient(135deg,#FF6B35,#8B5CF6)'),
      ('Gospel Impact',      'gospel-impact',      '🙌', 'linear-gradient(135deg,#52525B,#18181B)'),
      ('Food Fest 237',      'food-fest-237',      '🍲', 'linear-gradient(135deg,#C2410C,#FF6B35)')
    ) as t(name, slug, glyph, gradient)
  loop
    insert into spot.organizers (owner_id, name, slug, glyph, gradient, verified)
    values (p_owner_id, r.name, r.slug, r.glyph, r.gradient, true)
    on conflict (slug) do nothing;
  end loop;

  -- Événements + types de billets
  for r in
    select * from (values
      ('festival-afro',     'Festival Afro',      'festival-afro-2026',      'concert',     'Douala',     'Douala Bercy',           timestamptz '2026-08-15 18:00+01', '🎤', 'linear-gradient(135deg,#FF6B35,#C2410C)',  5000, 15000,  500,
       'Le plus grand festival afrobeat du Cameroun. 12 artistes, 2 scènes, village gastronomique et after-party jusqu''à l''aube.',
       'The biggest afrobeat festival in Cameroon. 12 artists, 2 stages, food village and after-party until dawn.'),
      ('activspaces',       'Startup Weekend',    'startup-weekend-2026',    'formation',   'Douala',     'ActivSpaces',            timestamptz '2026-08-22 09:00+01', '🚀', 'linear-gradient(135deg,#8B5CF6,#4C1D95)', 10000, 25000,   84,
       '54 heures pour passer de l''idée au prototype. Mentors, pitchs et prix pour les 3 meilleures équipes.',
       '54 hours from idea to prototype. Mentors, pitches and prizes for the top 3 teams.'),
      ('canal-comedy-club', 'Comedy Show 237',    'comedy-show-237-2026',    'culture',     'Douala',     'Canal Olympia',          timestamptz '2026-08-29 20:00+01', '🎭', 'linear-gradient(135deg,#FF6B35,#8B5CF6)',  2000,  8000,  230,
       'Une soirée stand-up avec les 6 humoristes les plus drôles du 237. Fous rires garantis.',
       'A stand-up night with the 6 funniest comedians in the 237. Guaranteed laughs.'),
      ('activspaces',       'Tech Conf Yaoundé',  'tech-conf-yaounde-2026',  'business',    'Yaoundé',    'Palais des Congrès',     timestamptz '2026-09-05 10:00+01', '💻', 'linear-gradient(135deg,#3B2A6B,#8B5CF6)',  3000, 12000,  410,
       'La conférence tech annuelle : IA, fintech et mobile money, avec les acteurs qui construisent le numérique camerounais.',
       'The annual tech conference: AI, fintech and mobile money, with the builders of Cameroonian tech.'),
      ('gospel-impact',     'Gospel Night',       'gospel-night-2026',       'religion',    'Yaoundé',    'Stade Ahmadou Ahidjo',   timestamptz '2026-09-12 19:00+01', '🙌', 'linear-gradient(135deg,#52525B,#18181B)',  1000,  5000, 1200,
       'Une nuit de louange avec les plus grandes chorales du pays.',
       'A night of worship with the country''s greatest choirs.'),
      ('food-fest-237',     'Food Fest 237',      'food-fest-237-2026',      'gastronomie', 'Bafoussam',  'Place des Fêtes',        timestamptz '2026-09-19 12:00+01', '🍲', 'linear-gradient(135deg,#C2410C,#FF6B35)',  2500,  7000,  320,
       'Le meilleur de la cuisine camerounaise : ndolé, poulet DG, eru… 40 stands et concours de cuisine.',
       'The best of Cameroonian cuisine: ndolé, poulet DG, eru… 40 stands and a cooking contest.')
    ) as t(org_slug, title, slug, cat, city, venue, starts_at, glyph, gradient, std, vip, remaining, desc_fr, desc_en)
  loop
    select id into v_org_id from spot.organizers where slug = r.org_slug;

    insert into spot.events (
      organizer_id, category_key, title, slug, description_fr, description_en,
      city, venue, starts_at, glyph, gradient, status, published_at
    )
    values (
      v_org_id, r.cat, r.title, r.slug, r.desc_fr, r.desc_en,
      r.city, r.venue, r.starts_at, r.glyph, r.gradient, 'published', now()
    )
    on conflict (slug) do nothing
    returning id into v_event_id;

    -- Déjà présent : on ne recrée pas les types de billets
    if v_event_id is null then
      continue;
    end if;

    insert into spot.ticket_types (event_id, name_fr, name_en, price_xaf, quantity_total, sort)
    values
      (v_event_id, 'Standard', 'Standard', r.std, r.remaining, 1),
      (v_event_id, 'VIP',      'VIP',      r.vip, greatest(r.remaining / 10, 10), 2);
  end loop;
end;
$$;

revoke execute on function spot.seed_demo_data(uuid) from public;
