begin;

-- La vida del Chota. A chapter opens each day, the club votes and the next request resolves it.
-- Chapters live in the database so new ones ship without an app update.
create schema club_story;
revoke all on schema club_story from public,anon,authenticated;

create table club_story.chapters (
  key text primary key check(key ~ '^[a-z0-9-]{2,40}$'),
  title text not null check(length(title) between 3 and 60),
  body text not null check(length(body) between 20 and 400),
  options jsonb not null check(jsonb_array_length(options) between 2 and 3),
  follow_up boolean not null default false
);
create table club_story.seasons (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique,
  money smallint not null default 50,
  fame smallint not null default 50,
  energy smallint not null default 50,
  trouble smallint not null default 50,
  ending_title text,
  ending_body text,
  ended_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);
create unique index club_story_one_open_season on club_story.seasons((true)) where ended_at is null;
create table club_story.days (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references club_story.seasons(id) on delete cascade,
  day date not null,
  chapter_key text not null references club_story.chapters(key),
  next_key text references club_story.chapters(key),
  twist_by uuid references auth.users(id) on delete set null,
  winner smallint,
  votes_total integer,
  resolved_at timestamptz,
  unique(season_id,day),
  unique(season_id,chapter_key)
);
create index club_story_days_recent_idx on club_story.days(day desc);
create table club_story.votes (
  day_id uuid not null references club_story.days(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option smallint not null check(option between 0 and 2),
  primary key(day_id,user_id)
);
create index club_story_votes_user_idx on club_story.votes(user_id);
create table club_story.members (
  season_id uuid not null references club_story.seasons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  streak smallint not null default 0,
  best smallint not null default 0,
  twist_used boolean not null default false,
  primary key(season_id,user_id)
);
alter table club_story.chapters enable row level security;
alter table club_story.seasons enable row level security;
alter table club_story.days enable row level security;
alter table club_story.votes enable row level security;
alter table club_story.members enable row level security;

create function club_story.o(label text,result text,money int,fame int,energy int,trouble int,next text default null) returns jsonb language sql immutable as
$$ select jsonb_strip_nulls(jsonb_build_object('label',label,'result',result,'money',money,'fame',fame,'energy',energy,'trouble',trouble,'next',next)) $$;

insert into club_story.chapters(key,title,body,options,follow_up) values
('cartera','La cartera de la Castellana','El Chota encuentra una cartera con 800 euros en un banco de la Castellana. Dentro hay un carné y una foto de un perro con gafas.',jsonb_build_array(
  club_story.o('Devolverla','El dueño resulta ser veterinario y le promete revisiones gratis de por vida.',-5,10,0,-10),
  club_story.o('Quedarse el dinero','Cena de marisco. Esa noche sueña con el perro de las gafas mirándole fijamente.',20,-5,-5,15,'perro-gafas')),false),
('perro-gafas','El perro de las gafas','El perro de la foto aparece en la puerta de la sede. Lleva las mismas gafas y no parece contento.',jsonb_build_array(
  club_story.o('Pedirle perdón','Le da un filete. El perro acepta el trato y se marcha sin mirar atrás.',-10,0,0,-10),
  club_story.o('Adoptarlo','Ahora hay un perro con gafas en la sede. Nadie se atreve a preguntar nada.',-5,10,-5,0),
  club_story.o('Cerrar la puerta','El perro espera. Lleva tres horas sentado ahí. Es peor que una multa.',0,-5,-10,5)),true),
('negocio-vice','Un negocio en Vice City','Un tipo con camisa de flamencos ofrece al Chota ser socio de un chiringuito en Vice City. Pide 2000 euros y no da apellidos.',jsonb_build_array(
  club_story.o('Invertir','El chiringuito existe. Más o menos. Hay un cartel y una nevera.',-15,5,0,10,'chiringuito'),
  club_story.o('Pedir el contrato','El tipo sale corriendo. La camisa se le cae por el camino y el Chota se la queda.',0,0,0,-5),
  club_story.o('Rechazarlo con estilo','Se va andando despacio sin mirar atrás. Alguien lo graba.',0,10,0,0)),false),
('chiringuito','Inspección en el chiringuito','Llega una inspección al chiringuito de Vice City. La nevera está llena de camisas y no hay ni una cerveza.',jsonb_build_array(
  club_story.o('Decir que es una tienda','Vende 40 camisas a los inspectores. Mejor negocio de su vida.',25,5,-5,5),
  club_story.o('Huir por la playa','Corre dos kilómetros en chanclas. Pierde una y toda su dignidad.',-5,-5,-15,15)),true),
('talento','Casting en televisión','Un programa de talentos busca a gente con habilidades raras. El Chota sabe dormirse en cinco segundos en cualquier sitio.',jsonb_build_array(
  club_story.o('Presentarse','Se duerme en directo y el jurado lo aplaude sin saber muy bien por qué.',5,20,5,0,'fama-sofa'),
  club_story.o('Mandar a otro','Manda a un primo. El primo gana. Ya no se hablan.',-5,-5,0,5)),false),
('fama-sofa','Rey del sofá','Una marca de colchones quiere al Chota como imagen. El contrato obliga a dormir ocho horas al día.',jsonb_build_array(
  club_story.o('Firmar','Le pagan por dormir. Ha encontrado su verdadera vocación.',20,10,15,0),
  club_story.o('Pedir el doble','La marca se ríe, luego acepta la mitad de lo que ofrecía.',5,0,0,5)),true),
('moto','La moto prestada','Un colega le deja una moto una semana. La condición es no arañarla. A los diez minutos ya tiene un arañazo.',jsonb_build_array(
  club_story.o('Confesar','El colega llora un poco. Lo pagan a medias y queda el honor intacto.',-10,5,0,-5),
  club_story.o('Taparlo con rotulador','Funciona de lejos. De cerca parece hecho por un niño.',0,-5,0,10),
  club_story.o('Decir que ya estaba','El colega revisa las fotos. Tenía fotos.',-5,-10,0,10)),false),
('retiro','Remo en El Retiro','El Chota se apunta a una carrera de barcas en El Retiro. Su rival es un señor de 80 años que no ha perdido nunca.',jsonb_build_array(
  club_story.o('Remar a muerte','Gana por un metro y no puede mover los brazos en dos días.',0,15,-20,0),
  club_story.o('Hacer trampas','Lo pillan atando un remo. El señor le mira con pena.',0,-10,0,10),
  club_story.o('Dejarle ganar','El señor le invita a comer. Le cuenta dónde tiene un dinero guardado.',10,0,5,0)),false),
('loteria','Décimo compartido','Compran un décimo entre todos y le toca al Chota guardarlo. No recuerda dónde lo ha puesto y hoy es el sorteo.',jsonb_build_array(
  club_story.o('Registrar la sede','Lo encuentra dentro de un libro. Tocan 50 euros y una gran tensión.',5,0,-10,0),
  club_story.o('Decir que no tocó','Nadie le cree. Empiezan a mirarle raro.',0,-10,0,10)),false),
('cumple','Cumpleaños sorpresa','Se ha ofrecido a organizar una fiesta sorpresa. El homenajeado acaba de preguntarle qué hace esta noche.',jsonb_build_array(
  club_story.o('Inventarse un funeral','Muy creíble. Quizá demasiado. La sorpresa sale, pero con un rato incómodo.',0,5,-5,5),
  club_story.o('Contárselo todo','Se pierde la sorpresa, pero hay mejor tarta.',-5,0,5,-5),
  club_story.o('Fingir que no oye','Lleva dos horas sin hablar. Ya es tarde para parar.',0,-5,-5,0)),false),
('gimnasio','Un año de gimnasio','Le ofrecen un año de gimnasio a mitad de precio. Ya pagó uno hace tres años y fue dos veces.',jsonb_build_array(
  club_story.o('Apuntarse otra vez','Va tres días seguidos. Récord personal. Después desaparece.',-10,0,15,0),
  club_story.o('Correr por Madrid Río','Dura doce minutos y ve una ardilla. Le parece suficiente.',0,0,10,0),
  club_story.o('Comprar un chándal','No hace deporte, pero tiene una pinta espectacular.',-5,5,0,0)),false),
('reloj','Reloj sin factura','Un señor en el metro le ofrece un reloj de oro por 50 euros. Marca una hora distinta cada vez que lo mira.',jsonb_build_array(
  club_story.o('Comprarlo','Vale exactamente 50 euros. Un tasador se ríe de él durante un rato.',-5,0,0,5),
  club_story.o('Regatear','Lo saca por 20 y el señor le da además un paraguas.',5,5,0,0),
  club_story.o('Avisar a seguridad','El señor ya no está. El reloj sí, en el bolsillo del Chota.',5,0,0,10,'reloj-dueno')),false),
('reloj-dueno','El dueño del reloj','Un hombre muy grande pregunta en la sede por un reloj de oro. Dice que es un recuerdo familiar.',jsonb_build_array(
  club_story.o('Devolverlo','El hombre grande sonríe. Es peor que cuando no sonreía.',-5,0,0,-15),
  club_story.o('Decir que no sabe nada','Se sienta a esperar. Se ha traído bocadillo.',0,0,-10,10)),true),
('podcast','Un podcast propio','Todo el mundo tiene un podcast y el Chota cree que le toca. Tiene un micrófono y ninguna idea.',jsonb_build_array(
  club_story.o('Hablar de sí mismo','Tres oyentes. Dos son su madre desde distintos móviles.',0,5,-5,0),
  club_story.o('Entrevistar al portero','El portero sabe todo de todos. Episodio viral.',5,20,0,10),
  club_story.o('Dejarlo antes de empezar','Una decisión valiente que el mundo agradece.',0,0,5,0)),false),
('multa','La multa misteriosa','Llega una multa de una ciudad en la que jura no haber estado. La foto muestra claramente su cara.',jsonb_build_array(
  club_story.o('Pagarla','Lo más barato. Sigue sin saber qué hacía allí.',-10,0,0,-5),
  club_story.o('Recurrir','Pasa cinco horas al teléfono escuchando la misma música.',0,0,-15,0),
  club_story.o('Ignorarla','Ya hay una segunda carta. Tiene otro color.',0,0,0,15)),false),
('cocina','Cena para el club','Promete cocinar para todos. Su única experiencia es un arroz que acabó en urgencias.',jsonb_build_array(
  club_story.o('Cocinar de verdad','Sorprendentemente comestible. Alguien pide la receta por educación.',-5,10,-5,0),
  club_story.o('Pedir comida y fingir','Funciona hasta que encuentran la bolsa del reparto.',-10,-5,0,5),
  club_story.o('Cancelar por enfermedad','Sube una foto en una fiesta ese mismo día.',0,-10,5,5)),false),
('coche-grua','Se lo lleva la grúa','El coche del Chota está en la grúa justo cuando alguien le espera. Dentro está lo más importante: su almuerzo.',jsonb_build_array(
  club_story.o('Ir a pagar','Pagar duele, el almuerzo sigue ahí y aún está bueno.',-15,0,0,-5),
  club_story.o('Negociar con el de la grúa','Acaban hablando de fútbol y le perdona media tasa.',-5,5,-5,0)),false),
('vecino','El vecino de arriba','El vecino de arriba hace ruido cada noche a las 3. Dicen que está construyendo algo. Algo grande.',jsonb_build_array(
  club_story.o('Subir a hablar','Está construyendo un barco. Le invita a la botadura.',0,5,-5,0,'barco'),
  club_story.o('Poner una nota','Recibe otra nota. Solo dice ya casi.',0,0,-5,0),
  club_story.o('Darle con la escoba','El ruido para y empieza otro, más lento. Peor.',0,0,-10,5)),false),
('barco','La botadura','El barco del vecino no cabe por la puerta. Es un quinto piso. Necesita ayuda y una grúa ilegal.',jsonb_build_array(
  club_story.o('Ayudarle','Sale en las noticias con un barco colgado sobre la calle.',-5,20,-10,15),
  club_story.o('Llamar al ayuntamiento','Barco confiscado. El vecino ya no saluda.',0,-5,5,-5)),true),
('criptomoneda','La moneda del Chota','Un amigo le convence de lanzar ChotaCoin. Dice que no se puede perder. Lo dice mucho.',jsonb_build_array(
  club_story.o('Lanzarla','Sube una tarde y baja para siempre. Queda algún meme.',-15,15,-5,10),
  club_story.o('Pasar','Mañana sale en un reportaje sobre gente que no cayó. Se siente sabio.',0,5,0,-5)),false),
('boda','Testigo de boda','Le toca dar un discurso en una boda. Se ha enterado esta mañana y ya va por la segunda copa.',jsonb_build_array(
  club_story.o('Improvisar','Cuenta la historia que juró no contar. Media sala llora, la otra no.',0,15,0,10),
  club_story.o('Leer algo de internet','Es el discurso de otra boda con otros nombres.',0,-10,0,0),
  club_story.o('Brindar y sentarse','Diez segundos. El mejor discurso que se recuerda.',0,10,5,0)),false),
('siesta','Vacaciones forzosas','El médico le manda descansar. Le dice que tiene los niveles de un hombre que ha visto cosas.',jsonb_build_array(
  club_story.o('Hacer caso','Tres días de sofá. Vuelve como nuevo y con la espalda torcida.',0,0,25,0),
  club_story.o('Irse de fiesta','Decide que el descanso es un estado mental. Se equivoca.',-10,5,-15,5)),false),
('subasta','Subasta en Argüelles','Sale a subasta un trastero de Argüelles sin saber qué hay dentro. El Chota levanta la mano sin querer.',jsonb_build_array(
  club_story.o('Pujar en serio','Dentro hay 300 sillas plegables. Ya se le ocurrirá algo.',-15,0,0,0),
  club_story.o('Rascarse disimulando','Acaba de comprar otro trastero.',-20,5,0,0),
  club_story.o('Salir corriendo','Hay vídeo de la huida. Se hace conocido en el barrio.',0,10,-5,5)),false),
('detective','Trabajo de detective','Una señora paga por seguir a su gato y saber con quién se ve. Es el trabajo más raro hasta ahora.',jsonb_build_array(
  club_story.o('Aceptar','El gato tiene tres familias. Cobra y entrega un informe excelente.',15,5,-10,0),
  club_story.o('Rechazarlo','La señora se lo cuenta a todo el barrio. Mala fama entre señoras.',0,-10,0,0)),false),
('hacienda','Carta de Hacienda','Llega un sobre de Hacienda. El Chota lleva tres días sin abrirlo y lo ha movido de habitación dos veces.',jsonb_build_array(
  club_story.o('Abrirlo','Le devuelven 12 euros. Casi llora.',5,0,5,-10),
  club_story.o('Llamar a un gestor','Cuesta más que la carta, pero duerme tranquilo.',-10,0,10,-10),
  club_story.o('Esconderlo mejor','Lo guarda detrás de la nevera. El problema sigue ahí.',0,0,-5,15)),false),
('concierto','Telonero por error','Por una confusión de nombres, un festival cree que el Chota es un grupo de rock. Actúa mañana.',jsonb_build_array(
  club_story.o('Actuar igualmente','Toca un triángulo veinte minutos. Crítica dividida.',10,20,-10,5),
  club_story.o('Aclararlo todo','Le dan una pulsera de agradecimiento y se va a casa.',0,0,5,0)),false),
('mudanza','Ayudar en una mudanza','Le piden ayuda para una mudanza. Es un cuarto sin ascensor con un piano.',jsonb_build_array(
  club_story.o('Ir','Sobrevive. Le pagan con pizza y una deuda moral eterna.',0,5,-20,0),
  club_story.o('Decir que le duele la espalda','Lo ven jugando al pádel.',0,-10,5,5)),false),
('taxi','Una maleta en el taxi','Al bajar de un taxi ve que alguien ha dejado una maleta. Pesa bastante y hace un ruido suave.',jsonb_build_array(
  club_story.o('Abrirla','Son 40 relojes despertadores. Suenan todos a las 7.',0,0,-10,0),
  club_story.o('Llevarla a objetos perdidos','Su dueña era actriz y le invita a un estreno.',0,15,0,-5),
  club_story.o('Quedársela sin abrir','Lleva días en la sede. Nadie duerme bien.',0,0,-10,10)),false),
('premio','Premio al vecino del año','El Chota es nominado a vecino del año. Nadie entiende cómo. Solo hay otro candidato y es un buzón.',jsonb_build_array(
  club_story.o('Hacer campaña','Reparte churros. Gana por dos votos al buzón.',-5,15,-5,0),
  club_story.o('Retirarse por respeto','Gana el buzón. Todo el barrio lo celebra.',0,-5,0,0)),false),
('ultima-cena','La cena del balance','Se acerca fin de mes y el Chota invita a hacer balance. La cuenta pendiente es más larga que la carta.',jsonb_build_array(
  club_story.o('Pagar todo','Queda en paz con todos y sin un euro.',-20,10,0,-15),
  club_story.o('Dividir a partes iguales','Quien pidió ensalada no lo perdona.',-5,-5,0,5),
  club_story.o('Ir al baño y no volver','Clásico. Ya se comenta en varios barrios.',5,-10,0,15)),false);

drop function club_story.o(text,text,int,int,int,int,text);

create function club_story.clamp(value integer) returns smallint language sql immutable set search_path='' as
$$ select greatest(0,least(100,value))::smallint $$;

-- Closes a day: the most voted option wins, a twist hands it to the runner-up.
create function club_story.resolve(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare d club_story.days; picked smallint; total integer; opts jsonb; chosen jsonb; ranked smallint[]; r record;
begin
  select * into d from club_story.days where id=target for update;
  if d.resolved_at is not null then return; end if;
  select options into opts from club_story.chapters where key=d.chapter_key;
  select array_agg(i::smallint order by votes desc,md5(i::text||d.id::text)),sum(votes) into ranked,total
    from (select i,(select count(*) from club_story.votes v where v.day_id=d.id and v.option=i) votes
      from generate_series(0,jsonb_array_length(opts)-1) i) c;
  picked:=case when d.twist_by is not null then ranked[2] else ranked[1] end;
  chosen:=opts->picked;
  update club_story.days set winner=picked,votes_total=total,resolved_at=statement_timestamp(),next_key=chosen->>'next' where id=d.id;
  update club_story.seasons set
    money=club_story.clamp(money+(chosen->>'money')::int),
    fame=club_story.clamp(fame+(chosen->>'fame')::int),
    energy=club_story.clamp(energy+(chosen->>'energy')::int),
    trouble=club_story.clamp(trouble+(chosen->>'trouble')::int)
    where id=d.season_id;
  for r in select user_id,option from club_story.votes where day_id=d.id loop
    insert into club_story.members(season_id,user_id,streak,best)
      values(d.season_id,r.user_id,(r.option=picked)::int,(r.option=picked)::int)
      on conflict(season_id,user_id) do update set
        streak=case when r.option=picked then club_story.members.streak+1 else 0 end,
        best=greatest(club_story.members.best,case when r.option=picked then club_story.members.streak+1 else 0 end);
    if r.option=picked then perform club_rewards.award_coins(r.user_id,'story-win:'||d.id,'club',2); end if;
  end loop;
end $$;

create function club_story.finish(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare s club_story.seasons; heading text; story text;
begin
  select * into s from club_story.seasons where id=target;
  if s.trouble>=75 then heading:='El Chota, entre rejas'; story:='Demasiados líos juntos. Sale en tres años y dice que no se arrepiente de nada.';
  elsif s.money>=75 then heading:='El Chota millonario'; story:='Se compra una barca en El Retiro y deja de contestar a los mensajes.';
  elsif s.fame>=75 then heading:='El Chota famoso'; story:='Le paran por la calle. Firma autógrafos con el nombre de otro.';
  elsif s.money<=25 then heading:='El Chota arruinado'; story:='Vende hasta el sofá. Lo recupera todo menos la dignidad.';
  elsif s.energy<=25 then heading:='El Chota agotado'; story:='Se queda dormido a mitad de la temporada y nadie se atreve a despertarlo.';
  else heading:='El Chota de siempre'; story:='Después de todo lo vivido sigue exactamente igual. Quizá esa sea la lección.';
  end if;
  update club_story.seasons set ending_title=heading,ending_body=story,ended_at=statement_timestamp() where id=target;
end $$;

-- Called by every read, so no scheduled job is needed.
create function club_story.advance() returns uuid language plpgsql security definer set search_path='' as $$
declare today date:=(statement_timestamp() at time zone 'Europe/Madrid')::date; s uuid; last_day club_story.days; pick text; played integer; follow text;
begin
  perform pg_advisory_xact_lock(hashtext('club_story.advance'));
  select id into s from club_story.seasons where ended_at is null;
  if s is null then
    insert into club_story.seasons(number) select coalesce(max(number),0)+1 from club_story.seasons returning id into s;
  end if;
  select * into last_day from club_story.days where season_id=s order by day desc limit 1;
  if found and last_day.day=today then return last_day.id; end if;
  if found then perform club_story.resolve(last_day.id); select next_key into follow from club_story.days where id=last_day.id; end if;
  select count(*) into played from club_story.days where season_id=s;
  select key into pick from club_story.chapters c where c.key=follow and not exists(select 1 from club_story.days d where d.season_id=s and d.chapter_key=c.key);
  if pick is null then
    select c.key into pick from club_story.chapters c
      where not c.follow_up and not exists(select 1 from club_story.days d where d.season_id=s and d.chapter_key=c.key)
      order by (select count(*) from club_story.days d where d.chapter_key=c.key),md5(c.key||today::text) limit 1;
  end if;
  if pick is null or played>=30 then
    perform club_story.finish(s);
    insert into club_story.seasons(number) select max(number)+1 from club_story.seasons returning id into s;
    select c.key into pick from club_story.chapters c where not c.follow_up
      order by (select count(*) from club_story.days d where d.chapter_key=c.key),md5(c.key||today::text) limit 1;
  end if;
  insert into club_story.days(season_id,day,chapter_key) values(s,today,pick) returning id into last_day.id;
  return last_day.id;
end $$;

create function club_story.state(actor uuid,current_day uuid) returns jsonb language sql stable security definer set search_path='' as $$
  with d as (select * from club_story.days where id=current_day),
  s as (select x.* from club_story.seasons x join d on d.season_id=x.id),
  c as (select ch.* from club_story.chapters ch join d on d.chapter_key=ch.key),
  mine as (select option from club_story.votes where day_id=current_day and user_id=actor),
  y as (select p.*,ch.title,ch.options from club_story.days p join club_story.chapters ch on ch.key=p.chapter_key
    where p.resolved_at is not null order by p.day desc limit 1)
  select jsonb_build_object('story',jsonb_build_object(
    'season',(select jsonb_build_object('number',number,'money',money,'fame',fame,'energy',energy,'trouble',trouble,
      'day',(select count(*) from club_story.days where season_id=s.id)) from s),
    'today',(select jsonb_build_object('id',d.id,'title',c.title,'body',c.body,'mine',(select option from mine),'twisted',d.twist_by is not null,
      'options',(select jsonb_agg(jsonb_build_object('i',o.ord-1,'label',o.value->>'label',
        'votes',case when exists(select 1 from mine) then (select count(*) from club_story.votes v where v.day_id=d.id and v.option=o.ord-1) end) order by o.ord)
        from jsonb_array_elements(c.options) with ordinality o(value,ord))) from d,c),
    'yesterday',(select jsonb_build_object('title',y.title,'choice',y.options->y.winner->>'label','result',y.options->y.winner->>'result',
      'money',(y.options->y.winner->>'money')::int,'fame',(y.options->y.winner->>'fame')::int,'energy',(y.options->y.winner->>'energy')::int,'trouble',(y.options->y.winner->>'trouble')::int,
      'votes',y.votes_total,'twist',y.twist_by) from y),
    'streak',coalesce((select streak from club_story.members m,d where m.season_id=d.season_id and m.user_id=actor),0),
    'best',coalesce((select best from club_story.members m,d where m.season_id=d.season_id and m.user_id=actor),0),
    'twist',not coalesce((select twist_used from club_story.members m,d where m.season_id=d.season_id and m.user_id=actor),false),
    'endings',coalesce((select jsonb_agg(jsonb_build_object('number',e.number,'title',e.ending_title,'body',e.ending_body,'at',e.ended_at) order by e.number desc)
      from club_story.seasons e where e.ended_at is not null),'[]'::jsonb)))
$$;

create function public.get_club_story() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard(); current_day uuid:=club_story.advance();
begin
  return club_story.state(actor,current_day);
end $$;

create function public.vote_club_story(p_day uuid,p_option integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard(); current_day uuid:=club_story.advance(); opts jsonb;
begin
  if p_day is distinct from current_day then raise exception 'Este capítulo ya ha terminado.' using errcode='22023'; end if;
  select c.options into opts from club_story.days d join club_story.chapters c on c.key=d.chapter_key where d.id=current_day;
  if p_option is null or p_option<0 or p_option>=jsonb_array_length(opts) then raise exception 'Esa opción no existe.' using errcode='22023'; end if;
  perform public.lock_banner_shop_actor();
  insert into club_story.votes(day_id,user_id,option) values(current_day,actor,p_option)
    on conflict(day_id,user_id) do update set option=excluded.option;
  perform club_rewards.award_coins(actor,'story-vote:'||current_day,'club',2);
  return club_story.state(actor,current_day);
end $$;

-- One per member and season, one per day. The name stays hidden until the day closes.
create function public.use_club_story_twist(p_day uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=club_plus.guard(); current_day uuid:=club_story.advance(); season uuid;
begin
  if p_day is distinct from current_day then raise exception 'Este capítulo ya ha terminado.' using errcode='22023'; end if;
  select season_id into season from club_story.days where id=current_day for update;
  if exists(select 1 from club_story.days where id=current_day and twist_by is not null) then raise exception 'Hoy ya han soltado un giro.' using errcode='22023'; end if;
  insert into club_story.members(season_id,user_id,twist_used) values(season,actor,true)
    on conflict(season_id,user_id) do update set twist_used=true where not club_story.members.twist_used;
  if not found then raise exception 'Ya has usado tu giro esta temporada.' using errcode='22023'; end if;
  update club_story.days set twist_by=actor where id=current_day;
  return club_story.state(actor,current_day);
end $$;

revoke all on all functions in schema club_story from public,anon,authenticated;
revoke all on function public.get_club_story(),public.vote_club_story(uuid,integer),public.use_club_story_twist(uuid) from public,anon;
grant execute on function public.get_club_story(),public.vote_club_story(uuid,integer),public.use_club_story_twist(uuid) to authenticated;

commit;
