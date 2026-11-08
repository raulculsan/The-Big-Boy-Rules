-- A member's daily dilemma vote is final: the first choice stays, a second
-- attempt is refused instead of replacing it.
create or replace function public.vote_club_story(p_day uuid, p_option integer) returns jsonb
language plpgsql security definer set search_path = '' as $function$
declare actor uuid:=club_plus.guard(); current_day uuid:=club_story.advance(); opts jsonb;
begin
  if p_day is distinct from current_day then raise exception 'Este capítulo ya ha terminado.' using errcode='22023'; end if;
  select c.options into opts from club_story.days d join club_story.chapters c on c.key=d.chapter_key where d.id=current_day;
  if p_option is null or p_option<0 or p_option>=jsonb_array_length(opts) then raise exception 'Esa opción no existe.' using errcode='22023'; end if;
  perform public.lock_banner_shop_actor();
  if exists (select 1 from club_story.votes where day_id=current_day and user_id=actor) then
    raise exception 'Ya has votado hoy. Tu decisión no se puede cambiar.' using errcode='23505';
  end if;
  insert into club_story.votes(day_id,user_id,option) values(current_day,actor,p_option);
  perform club_rewards.award_coins(actor,'story-vote:'||current_day,'club',2);
  return club_story.state(actor,current_day);
end $function$;
