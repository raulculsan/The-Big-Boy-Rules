-- Ajuste del baremo GLOBAL Coleccionista. Después de supabase-card-acquisition-achievements.sql.
-- Repetible y atómico: conserva filas históricas, premios y progreso; no toca Los Nuestros.
begin;
select pg_advisory_xact_lock(73142,244);
alter table public.achievements add column if not exists retired_at timestamptz;
update public.achievements a set retired_at=coalesce(a.retired_at,clock_timestamp())
from public.achievement_rules r where r.achievement_id=a.id
 and r.seed_key in ('acquired:v1:global:1','acquired:v1:global:5','acquired:v1:global:10','acquired:v1:global:25');
-- Mantiene la identidad y los premios del objetivo de 50 cartas ya existente.
update public.achievements a set tier='bronze'
from public.achievement_rules r where r.achievement_id=a.id and r.seed_key='acquired:v1:global:50';
create or replace function public.credit_card_acquisition(actor uuid, acquired_card text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare card record; rule record;
begin
 -- Serializa adquisiciones y creación/backfill de objetivos para evitar carreras.
 perform pg_advisory_xact_lock(73142,244);
 select * into card from public.achievement_card_catalog where id=acquired_card;
 if not found then return; end if;
 insert into public.member_card_acquisitions(user_id,card_id,collection_key,card_edition,card_kind)
 values(actor,card.id,card.collection_key,card.edition,card.kind) on conflict do nothing;
 if not found then return; end if;
 for rule in select * from public.achievement_rules r where metric='cards_acquired'
  and exists(select 1 from public.achievements a where a.id=r.achievement_id and a.retired_at is null)
  and (collection_key is null or collection_key=card.collection_key)
  and (card_edition is null or card_edition=card.edition)
  and (card_kind is null or card_kind=card.kind) order by achievement_id
 loop
  perform public.record_achievement_activity(actor,'cards_acquired','acquired:'||card.id,rule.achievement_id);
 end loop;
end $$;
revoke all on function public.credit_card_acquisition(uuid,text) from public,anon,authenticated;

create or replace function public.backfill_card_acquisition_achievement(target_achievement bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare rule record; acquired record;
begin
 perform pg_advisory_xact_lock(73142,244);
 select * into rule from public.achievement_rules where achievement_id=target_achievement and metric='cards_acquired'
  and exists(select 1 from public.achievements a where a.id=target_achievement and a.retired_at is null);
 if not found then return; end if;
 for acquired in select * from public.member_card_acquisitions a
  where (rule.collection_key is null or a.collection_key=rule.collection_key)
   and (rule.card_edition is null or a.card_edition=rule.card_edition)
   and (rule.card_kind is null or a.card_kind=rule.card_kind) order by user_id,card_id
 loop
  perform public.record_achievement_activity(acquired.user_id,'cards_acquired','acquired:'||acquired.card_id,rule.achievement_id);
 end loop;
end $$;
revoke all on function public.backfill_card_acquisition_achievement(bigint) from public,anon,authenticated;

do $$ declare owner_id uuid; goal integer; target_id bigint; seed text;
begin
 select id into owner_id from public.profiles where role in ('admin','superadmin') and not is_hidden order by id limit 1;
 if owner_id is null then raise exception 'No hay administrador para firmar los objetivos Coleccionista.'; end if;
 foreach goal in array array[50,100,250,500] loop
  seed:='acquired:v1:global:'||goal;
  select achievement_id into target_id from public.achievement_rules where seed_key=seed;
  if not found then
   insert into public.achievements(name,description,tier,created_by)
    values('Coleccionista · '||goal,'Consigue '||goal||' cartas distintas entre todas las colecciones.',
      case goal when 50 then 'bronze' when 100 then 'silver' when 250 then 'gold' else 'platinum' end,owner_id)
    returning id into target_id;
   insert into public.achievement_rules(achievement_id,metric,target_count,seed_key)
    values(target_id,'cards_acquired',goal,seed);
  end if;
  -- Nunca reactiva un logro retirado por una operación posterior.
  perform public.backfill_card_acquisition_achievement(target_id);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
select a.name,a.tier,r.target_count,a.retired_at is null as visible,
 (select count(*) from public.achievement_awards aw where aw.achievement_id=a.id) as historical_awards
from public.achievement_rules r join public.achievements a on a.id=r.achievement_id
where r.seed_key like 'acquired:v1:global:%' order by r.target_count;
