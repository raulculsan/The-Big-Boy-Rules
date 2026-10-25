/* Short arcade sessions. Daily packs are validated and granted by the server. */
(() => {
  'use strict';
  const games = {
    football: {name:'Toques en la sede',item:'Pelota',art:'football-v2.png',unit:'toques',help:'Mantén el balón en el aire con toques. Supera el objetivo antes de que acaben los 30 segundos para desbloquear el siguiente nivel. Cada nivel tiene más velocidad y viento.'},
    skateboard: {name:'Salta con El Chota',item:'Skate',art:'skateboard-v2.png',unit:'saltos',help:'Toca la pista para saltar las cajas. Completa el recorrido sin chocar para abrir el siguiente nivel. Cada recorrido es más rápido y tiene más obstáculos.'},
    'robot-vacuum': {name:'La última miga',item:'Roomba',art:'robot-vacuum-v2.png',unit:'migas',help:'Arrastra la roomba para limpiar todas las migas. Cada nivel abre una habitación distinta y más grande; la cámara te sigue. Tienes 3 vidas y cada golpe de polvo quita una. El tercer golpe termina la partida.'}
  };
  const maxLevel=5;
  const levelRules=(id,level)=>({
    goal:id==='football'?[10,14,18,22,26][level-1]:id==='skateboard'?[8,10,12,14,16][level-1]:30,
    duration:id==='robot-vacuum'?[30,40,50,60,75][level-1]:30,
    name:id==='robot-vacuum'?['El rincón','El salón','El pasillo','El taller','La gran sede'][level-1]:id==='skateboard'?['Primeras cajas','En marcha','A toda pista','Sin frenos','El gran recorrido'][level-1]:['Primeros toques','Más ritmo','Viento cruzado','Alta velocidad','Control total'][level-1]
  });
  let levelProgress={},progressOwner=null;
  const progressKey=()=>`bb:chota-levels:v1:${user()}`;
  function readProgress(){if(progressOwner===user())return;progressOwner=user();try{levelProgress=JSON.parse(localStorage.getItem(progressKey())||'{}')||{};}catch{levelProgress={};}for(const id of Object.keys(games))levelProgress[id]=Math.max(0,Math.min(maxLevel,Math.floor(Number(levelProgress[id])||0)));}
  function cacheProgress(data){readProgress();for(const id of Object.keys(games))if(Number.isInteger(data?.[id]))levelProgress[id]=Math.max(0,Math.min(maxLevel,data[id]));try{localStorage.setItem(progressKey(),JSON.stringify(levelProgress));}catch{}}
  const unlocked=id=>Math.min(maxLevel,(Number(levelProgress[id])||0)+1);
  async function rpc(name,args){const result=await config.rpc(name,args);if(result?.error)throw result.error;return result?.data;}
  async function loadProgress(){readProgress();if(config.rpc){const actor=user();const data=await rpc('get_chota_level_progress');if(actor===user())cacheProgress(data);}}
  function roomFor(level){
    const sizes=[[600,450],[720,520],[840,600],[960,680],[1080,760]];
    const layouts=[
      [[126,205,76,72],[366,280,98,55],[390,132,62,65]],
      [[105,155,120,65],[360,160,70,130],[190,330,130,62],[495,355,105,68]],
      [[130,170,140,65],[420,145,95,100],[610,270,90,100],[265,365,155,65],[510,450,140,60]],
      [[115,155,95,115],[345,170,145,65],[650,145,110,85],[205,390,135,85],[530,350,95,130],[740,510,110,60]],
      [[120,170,150,75],[405,145,105,115],[715,170,135,70],[870,340,90,120],[230,400,110,110],[495,365,135,70],[560,570,150,65],[110,600,125,65]]
    ];
    return {width:sizes[level-1][0],height:sizes[level-1][1],furniture:layouts[level-1].map(([x,y,w,h])=>({x,y,w,h})),palette:[['#59412e','#252e44','#b87a38'],['#594c39','#244443','#bc9567'],['#4e4356','#333552','#b5a07a'],['#514639','#334337','#c58d52'],['#4b3c3d','#3e2e49','#c99b67']][level-1]};
  }
  let config = {}, dialog = null, round = null, frame = 0, root = null, previousFocus = null, serial = 0, holdTimer = 0;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const user = () => String(config.session?.() || 'guest');
  const key = () => `bb:chota-games:v1:${user()}`;
  function scores(){try{return JSON.parse(localStorage.getItem(key()) || '{}') || {};}catch{return {};}}
  function save(game,score){const best=scores();best[game]=Math.max(Number(best[game]) || 0,score);try{localStorage.setItem(key(),JSON.stringify(best));}catch{}return best[game];}
  async function owned(){
    const data = config.getOwnedItems ? await config.getOwnedItems() : await globalThis.ChotaShop?.refresh?.();
    const items = Array.isArray(data) ? data : data?.items;
    if(items)return new Set(items.filter(i=>typeof i==='string'||i.owned===true).map(i=>typeof i==='string'?i:i.art_key));
    return new Set(Object.keys(games).filter(id=>document.querySelector(`.chota-room-${id}`)));
  }
  function mount(container){
    if(!container)return;
    root=container;
    root.classList.add('chota-arcade-entry');
    root.innerHTML='<button type="button" data-chota-arcade aria-label="Juegos de El Chota" title="Juegos de El Chota"><svg viewBox="0 0 28 24" aria-hidden="true"><path d="M8 6h12c3 0 4 3 5 9s-2 7-5 3l-2-2h-8l-2 2c-3 4-6 3-5-3S5 6 8 6Z"/><path d="M8 9v6m-3-3h6"/><circle cx="19" cy="10" r="1"/><circle cx="22" cy="13" r="1"/></svg></button>';
    root.querySelector('button').addEventListener('click',open);
  }
  function stop(){cancelAnimationFrame(frame);clearTimeout(holdTimer);holdTimer=0;frame=0;round=null;}
  function close({immediate=false}={}){serial++;stop();const old=dialog;dialog=null;const finish=()=>{old?.remove();if(!dialog&&!document.querySelector('dialog[open]'))previousFocus?.focus?.({preventScroll:true});};if(old&&globalThis.ClubMotion?.closeDialog)return globalThis.ClubMotion.closeDialog(old,finish,{immediate});old?.close();finish();return Promise.resolve();}
  async function open(){
    if(dialog)return;
    previousFocus=document.activeElement;
    dialog=document.createElement('dialog');dialog.className='chota-arcade';dialog.setAttribute('aria-label','Minijuegos de El Chota');
    dialog.innerHTML='<div class="chota-arcade-shell"><header><h2>Juegos</h2><button type="button" data-arcade-close aria-label="Cerrar minijuegos">Cerrar</button></header><div data-arcade-body aria-live="polite"><p>Cargando sus objetos…</p></div></div>';
    document.body.append(dialog);dialog.showModal();
    dialog.querySelector('[data-arcade-close]').addEventListener('click',close);
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
    await menu();
  }
  async function menu(){
    stop();const token=++serial, actor=user();
    if(!dialog)return;
    let inventory;
    try{[inventory]=await Promise.all([owned(),loadProgress().catch(()=>{})]);}catch{inventory=new Set();}
    if(token!==serial||actor!==user()||!dialog)return;
    const best=scores();
    body().innerHTML=`<div class="chota-arcade-games">${Object.entries(games).map(([id,g])=>`<button class="chota-arcade-game" type="button" data-game="${id}" aria-describedby="chotaGameHelpHint" ${inventory.has(id)?'':'data-locked="true"'}><img src="icons/clubhouse/props/${g.art}" alt="" draggable="false"><span><strong>${g.name}</strong><small>${inventory.has(id)?`Nivel ${unlocked(id)} de ${maxLevel} · Récord ${Number(best[id])||0}`:`Necesitas ${g.item.toLowerCase()}`}</small></span><b>${inventory.has(id)?'Jugar':'Tienda'}</b></button>`).join('')}</div><div class="chota-arcade-menu-note"><p>1 sobre por juego al día</p><p id="chotaGameHelpHint">Mantén pulsado un juego para ver cómo jugar.</p></div>`;
    body().querySelectorAll('[data-game]').forEach(button=>{
      let press=null,suppressUntil=0;
      const clearHold=()=>{clearTimeout(holdTimer);holdTimer=0;press=null;button.classList.remove('is-holding');};
      const explain=()=>{clearHold();suppressUntil=performance.now()+900;briefing(button.dataset.game,button.dataset.locked==='true');};
      button.addEventListener('pointerdown',event=>{
        if(event.button!==0||!event.isPrimary)return;
        clearHold();press={x:event.clientX,y:event.clientY};button.classList.add('is-holding');
        holdTimer=setTimeout(explain,450);
      });
      button.addEventListener('pointermove',event=>{if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>10)clearHold();});
      ['pointerup','pointercancel','pointerleave','lostpointercapture'].forEach(type=>button.addEventListener(type,clearHold));
      button.addEventListener('contextmenu',event=>{event.preventDefault();if(performance.now()>=suppressUntil)explain();});
      button.addEventListener('keydown',event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();explain();}});
      button.addEventListener('click',event=>{
        clearHold();if(performance.now()<suppressUntil){event.preventDefault();return;}
        if(button.dataset.locked){if(config.openShop){close();config.openShop();}return;}
        levels(button.dataset.game);
      });
    });
  }
  async function weeklyChallenge(node){
    if(!node)return;if(!config.rpc){node.innerHTML='<p>El reto semanal no está disponible ahora.</p>';return;}const actor=user();
    try{const {data,error}=await config.rpc('get_chota_weekly_challenge');if(error)throw error;if(!node.isConnected||actor!==user())return;
      const game=games[data.game];
      node.innerHTML=`<div class="club-weekly-heading"><span>RETO DE LA SEMANA</span><small>Hasta ${new Date(data.ends_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</small></div><h3>${esc(game?.name||'El reto del club')}</h3><p>Consigue ${Number(data.target)} puntos. Cuando ${Number(data.club_goal)} miembros lo consigan, cada participante que supere el reto recibe ${Number(data.club_reward_packs)} sobres.</p><div class="club-weekly-progress"><progress value="${Math.min(Number(data.participants)||0,Number(data.club_goal)||3)}" max="${Number(data.club_goal)||3}"></progress><span>${Number(data.participants)||0}/${Number(data.club_goal)||3} miembros · Tu marca: ${Number(data.my_best)||0}</span></div><ol class="club-weekly-ranking">${(data.leaderboard||[]).slice(0,10).map((r,i)=>`<li><span>${i+1}. ${esc(r.name||'Miembro')}</span><strong>${Number(r.score)||0}</strong></li>`).join('')||'<li>Aún no hay marcas esta semana.</li>'}</ol>${data.reward_claimed?'<p>Recompensa recibida</p>':data.club_complete&&Number(data.my_best)>=Number(data.target)?'<button type="button" data-weekly-claim>Recoger sobres</button>':'<p>Las partidas guardadas cuentan automáticamente para este reto.</p>'}`;
      node.querySelector('[data-weekly-claim]')?.addEventListener('click',async e=>{e.target.disabled=true;try{const r=await config.rpc('claim_chota_weekly_reward');if(r.error)throw r.error;void globalThis.DailyPacks?.refresh(true);await weeklyChallenge(node);}catch{e.target.disabled=false;e.target.textContent='Reintentar recompensa';}});
    }catch{if(node.isConnected)node.innerHTML='<p>El reto semanal no está disponible. Puedes seguir jugando y guardar tus marcas.</p>';}
  }
  const body=()=>dialog?.querySelector('[data-arcade-body]');
  function briefing(id,locked=false){
    clearTimeout(holdTimer);holdTimer=0;const g=games[id];
    body().innerHTML=`<section class="chota-arcade-brief"><img src="icons/clubhouse/props/${g.art}" alt="" draggable="false"><h2 tabindex="-1">${g.name}</h2><p>${g.help}</p>${locked?'<p>Consigue este objeto en la tienda para jugar.</p>':'<button type="button" data-start>Jugar</button>'}<button type="button" class="chota-arcade-secondary" data-menu>Volver a los juegos</button></section>`;
    body().querySelector('[data-start]')?.addEventListener('click',()=>levels(id));
    body().querySelector('[data-menu]').addEventListener('click',menu);
    body().querySelector('h2').focus({preventScroll:true});
  }
  function levels(id,message=''){
    stop();serial++;readProgress();if(!dialog)return;
    const cleared=Number(levelProgress[id])||0;
    body().innerHTML=`<section class="chota-level-select"><div class="chota-level-heading"><img src="icons/clubhouse/props/${games[id].art}" alt=""><div><h2 tabindex="-1">${games[id].name}</h2><p>${cleared===maxLevel?'Todos los niveles superados':`${cleared} de ${maxLevel} superados`}</p></div></div>${message?`<p role="status" class="chota-level-error">${esc(message)}</p>`:''}<div class="chota-level-list">${Array.from({length:maxLevel},(_,index)=>{const level=index+1,rules=levelRules(id,level),locked=level>unlocked(id);return `<button type="button" data-level-start="${level}" ${locked?'disabled':''}><span class="chota-level-number">${level}</span><span><strong>${rules.name}</strong><small>${id==='robot-vacuum'?`30 migas · ${rules.duration} s`:id==='football'?`${rules.goal} toques · 30 s`:`${rules.goal} cajas · 30 s`}</small></span><b>${locked?'Bloqueado':level<=cleared?'Superado':'Jugar'}</b></button>`;}).join('')}</div><button type="button" class="chota-arcade-secondary" data-menu>Volver a juegos</button></section>`;
    body().querySelectorAll('[data-level-start]').forEach(button=>button.addEventListener('click',()=>start(id,Number(button.dataset.levelStart))));
    body().querySelector('[data-menu]').addEventListener('click',menu);body().querySelector('h2').focus({preventScroll:true});
  }
  async function start(id,level=1){
    stop();const token=++serial,actor=user();readProgress();
    if(!games[id]||!Number.isInteger(level)||level<1||level>unlocked(id)){levels(id);return;}
    body().innerHTML='<p role="status">Preparando el nivel…</p>';
    let sessionId;
    try{sessionId=config.rpc?await rpc('start_chota_level',{target_game:id,target_level:level}):config.startGame?await config.startGame(id):null;}
    catch{if(dialog&&token===serial&&actor===user())levels(id,'No se pudo preparar la partida. Comprueba la conexión y vuelve a intentarlo.');return;}
    if(!dialog||token!==serial||actor!==user())return;
    const rules=levelRules(id,level),world=roomFor(level);
    body().innerHTML=`<div class="chota-arcade-score"><div><span>${games[id].unit}</span><strong data-score>0 / ${rules.goal}</strong></div><h2>${games[id].name}</h2><div><span>Tiempo</span><strong data-clock>${rules.duration}</strong></div></div><div class="chota-arcade-round-status"><div class="chota-arcade-level"><strong>Nivel ${level} · ${rules.name}</strong><progress data-level-progress value="0" max="${rules.goal}" aria-label="Objetivo del nivel"></progress><span data-level-next>${id==='football'?`Consigue ${rules.goal} toques en ${rules.duration} segundos`:id==='skateboard'?`Supera ${rules.goal} cajas sin chocar`:'Limpia las 30 migas del mapa'}</span></div>${id==='robot-vacuum'?'<div class="chota-arcade-lives" data-lives role="img" aria-label="3 vidas restantes">'+Array.from({length:3},()=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20S3 14.7 3 8.7A5.2 5.2 0 0 1 12 5a5.2 5.2 0 0 1 9 3.7C21 14.7 12 20 12 20Z"/></svg>').join('')+'</div>':''}</div><div class="chota-arcade-stage" role="application" aria-label="${esc(games[id].help)}" tabindex="0"><canvas aria-label="Zona de juego"></canvas><span class="chota-arcade-hint">${id==='football'?'Toca el balón':id==='skateboard'?'Toca para saltar':'Arrastra para limpiar'}</span></div><button type="button" class="chota-arcade-secondary" data-abandon>Terminar partida</button>`;
    const stage=body().querySelector('.chota-arcade-stage'), canvas=stage.querySelector('canvas'),ctx=canvas.getContext('2d');
    if(!ctx){levels(id,'Este dispositivo no pudo abrir el juego.');return;}
    const dpr=Math.min(devicePixelRatio||1,2);canvas.width=600*dpr;canvas.height=450*dpr;ctx.scale(dpr,dpr);ctx.imageSmoothingEnabled=false;
    const r=round={id,token,actor,score:0,level,rules,world,time:0,last:0,completed:false,endReason:'',lastHit:-1,misses:0,ball:{x:300,y:140,vy:0,vx:85+(level-1)*28},jump:0,vy:0,skateAir:0,skateLanding:0,x:world.width/2,y:world.height-65,target:{x:world.width/2,y:world.height-65},camera:{x:Math.max(0,world.width/2-300),y:Math.max(0,world.height-450)},lives:3,invulnerable:.9,stunned:0,hazards:Array.from({length:1+Math.floor((level-1)/2)},(_,index)=>({phase:-1.55+index*2.75,x:82,y:185,age:0})),furniture:world.furniture,obstacles:[],spawn:.5,cleared:0,drag:null,crumbs:[],serverSession:Promise.resolve(sessionId)};
    if(id==='robot-vacuum'){
      // Deterministic cells spread the objective over the whole room. Furniture
      // has a clear margin so crumbs cannot spawn under an obstacle.
      const cells=[];for(let y=135;y<world.height-45;y+=38)for(let x=58;x<world.width-45;x+=38)if(!r.furniture.some(o=>x>o.x-35&&x<o.x+o.w+35&&y>o.y-30&&y<o.y+o.h+30))cells.push({x,y,active:true});
      let seed=level*193;for(let i=cells.length-1;i>0;i--){seed=(seed*1664525+1013904223)>>>0;const j=seed%(i+1);[cells[i],cells[j]]=[cells[j],cells[i]];}
      r.crumbs=cells.slice(0,30);
    }
    r.art=new Image();r.art.src=`icons/clubhouse/props/${games[id].art}`;r.pet=new Image();r.pet.src='icons/mascot/chota-v2/chota-poses.webp';
    const clampTarget=p=>{r.target.x=Math.max(46,Math.min(world.width-46,p.x));r.target.y=Math.max(125,Math.min(world.height-35,p.y));};
    const point=e=>{const b=canvas.getBoundingClientRect();return{x:(e.clientX-b.left)/b.width*600+(id==='robot-vacuum'?r.camera.x:0),y:(e.clientY-b.top)/b.height*450+(id==='robot-vacuum'?r.camera.y:0)};};
    function act(e){
      if(round!==r)return;
      if(e.type==='keydown'&&![' ','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
      if(e.type==='keydown'&&id==='robot-vacuum'){e.preventDefault();clampTarget({x:r.target.x+(e.key==='ArrowRight'?45:e.key==='ArrowLeft'?-45:0),y:r.target.y+(e.key==='ArrowDown'?45:e.key==='ArrowUp'?-45:0)});return;}
      e.preventDefault();const p=e.type==='keydown'?{x:r.ball.x,y:r.ball.y}:point(e);
      if(id==='football'&&r.time-r.lastHit>.26&&Math.hypot(p.x-r.ball.x,p.y-r.ball.y)<46-(level-1)*2){r.lastHit=r.time;r.ball.vy=-380-(level-1)*28;r.ball.vx=Math.max(-270,Math.min(270,r.ball.vx*.45+(r.ball.x-p.x)*6+(Math.random()-.5)*(65+(level-1)*16)));r.score++;}
      else if(id==='skateboard'&&r.jump===0){r.vy=500;r.jump=1;r.skateAir=0;r.skateLanding=0;}
      else if(id==='robot-vacuum'){r.drag=e.pointerId;r.pointer={x:e.clientX,y:e.clientY};stage.setPointerCapture?.(e.pointerId);clampTarget(p);}
    }
    stage.addEventListener('pointerdown',act);stage.addEventListener('keydown',act);
    stage.addEventListener('pointermove',e=>{if(round===r&&r.drag===e.pointerId){e.preventDefault();clampTarget(point(e));r.pointer={x:e.clientX,y:e.clientY};}});
    stage.addEventListener('pointerup',()=>{r.drag=null;r.pointer=null;});stage.addEventListener('pointercancel',()=>{r.drag=null;r.pointer=null;});
    body().querySelector('[data-abandon]').addEventListener('click',()=>{r.endReason='abandoned';finish(r);});stage.focus({preventScroll:true});
    const scoreLabel=body().querySelector('[data-score]'),clockLabel=body().querySelector('[data-clock]'),goalProgress=body().querySelector('[data-level-progress]'),livesLabel=body().querySelector('[data-lives]');let shownLives=3;
    const loop=now=>{
      if(round!==r||token!==serial||!dialog)return;
      if(r.actor!==user()){close();return;}
      const dt=r.last?Math.min((now-r.last)/1000,.04):0;r.last=now;r.time+=dt;
      if(id==='robot-vacuum'&&r.pointer)clampTarget(point({clientX:r.pointer.x,clientY:r.pointer.y}));
      update(r,dt);if(round!==r)return;draw(ctx,r);
      const scoreText=`${r.score} / ${rules.goal}`;if(scoreLabel.textContent!==scoreText)scoreLabel.textContent=scoreText;if(goalProgress.value!==Math.min(r.score,rules.goal))goalProgress.value=Math.min(r.score,rules.goal);
      if(livesLabel&&shownLives!==r.lives){shownLives=r.lives;livesLabel.setAttribute('aria-label',`${r.lives} ${r.lives===1?'vida restante':'vidas restantes'}`);livesLabel.querySelectorAll('svg').forEach((heart,index)=>heart.classList.toggle('is-lost',index>=r.lives));}
      const seconds=String(Math.max(0,Math.ceil(rules.duration-r.time)));if(clockLabel.textContent!==seconds)clockLabel.textContent=seconds;
      const goal=r.score>=rules.goal;
      if((id!=='football'&&goal)||r.time>=rules.duration){r.completed=true;r.endReason=goal?'goal':'time';finish(r);return;}
      frame=requestAnimationFrame(loop);
    };frame=requestAnimationFrame(loop);
  }
  function update(r,dt){
    const difficulty=r.level-1;
    if(r.id==='football'){
      r.ball.vy+=(610+difficulty*82)*dt;
      r.ball.vx+=Math.sin(r.time*(1.7+difficulty*.18))*(36+difficulty*24)*dt;
      r.ball.y+=r.ball.vy*dt;r.ball.x+=r.ball.vx*dt;
      if(r.ball.x<30||r.ball.x>570){r.ball.x=Math.max(30,Math.min(570,r.ball.x));r.ball.vx*=-.92;}
      if(r.ball.y<34){r.ball.y=34;r.ball.vy=Math.abs(r.ball.vy)*.55;}
      if(r.ball.y>485){r.misses++;r.ball={x:160+Math.random()*280,y:130,vy:0,vx:(Math.random()<.5?-1:1)*(90+difficulty*28)};}
    }
    if(r.id==='skateboard'){
      r.skateLanding=Math.max(0,r.skateLanding-dt);
      if(r.jump>0){r.skateAir+=dt;r.vy-=1200*dt;r.jump=Math.max(0,r.jump+r.vy*dt);if(r.jump===0){r.skateLanding=.25;r.vy=0;}}
      r.spawn-=dt;if(r.spawn<=0){r.obstacles.push({x:660,passed:false});r.spawn=1.35-difficulty*.12+Math.random()*.4;}
      for(const o of r.obstacles){o.x-=(220+difficulty*32)*dt;if(!o.passed&&o.x<110){o.passed=true;r.score++;}if(o.x<184&&o.x>112&&r.jump<43){r.completed=true;r.endReason='collision';finish(r);return;}}
      r.obstacles=r.obstacles.filter(o=>o.x>-50);
    }
    if(r.id==='robot-vacuum'){
      r.stunned=Math.max(0,r.stunned-dt);
      r.invulnerable=Math.max(0,r.invulnerable-dt);
      const distance=Math.hypot(r.target.x-r.x,r.target.y-r.y),step=Math.min(distance,(r.stunned>0?65:210)*dt);
      if(distance>1){
        const dx=(r.target.x-r.x)/distance*step,dy=(r.target.y-r.y)/distance*step;
        const blocked=(x,y)=>r.furniture.some(o=>x>o.x-28&&x<o.x+o.w+28&&y>o.y-21&&y<o.y+o.h+21);
        if(!blocked(r.x+dx,r.y))r.x+=dx;
        if(!blocked(r.x,r.y+dy))r.y+=dy;
      }
      const count=r.hazards.length;
      for(let index=0;index<count;index++){
        const hazard=r.hazards[index];hazard.age+=dt;hazard.phase+=(.9+difficulty*.16+index*.08)*dt;
        hazard.x=r.world.width/2+Math.sin(hazard.phase)*(r.world.width/2-70);hazard.y=125+(r.world.height-165)/2+Math.cos(hazard.phase*1.5+index)*(r.world.height-165)/2;
        if(hazard.age>.7&&r.invulnerable<=0&&Math.hypot(hazard.x-r.x,hazard.y-r.y)<39){
          r.lives--;r.invulnerable=1.5;r.stunned=.6;
          if(r.lives===0){r.completed=true;r.endReason='dust';finish(r);return;}
        }
      }
      for(const c of r.crumbs)if(c.active&&Math.hypot(c.x-r.x,c.y-r.y)<25){c.active=false;r.score++;}
      const follow=Math.min(1,dt*9);r.camera.x+=(Math.max(0,Math.min(r.world.width-600,r.x-300))-r.camera.x)*follow;r.camera.y+=(Math.max(0,Math.min(r.world.height-450,r.y-225))-r.camera.y)*follow;
    }
  }
  function draw(ctx,r){
    ctx.clearRect(0,0,600,450);ctx.save();
    const roaming=r.id==='robot-vacuum',w=roaming?r.world.width:600,h=roaming?r.world.height:450;
    if(roaming)ctx.translate(-r.camera.x,-r.camera.y);
    const palette=roaming?r.world.palette:['#59412e','#252e44','#b87a38'];
    ctx.fillStyle='#252c31';ctx.fillRect(0,0,w,h);ctx.fillStyle=palette[0];ctx.fillRect(0,100,w,h-100);
    ctx.strokeStyle='#302c2780';ctx.lineWidth=3;for(let y=110;y<h;y+=38){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}for(let x=0;x<w;x+=95){ctx.beginPath();ctx.moveTo(x,100);ctx.lineTo(x+80,h);ctx.stroke();}
    ctx.fillStyle=palette[1];ctx.fillRect(28,120,w-56,h-160);ctx.strokeStyle=palette[2];ctx.lineWidth=5;ctx.strokeRect(38,130,w-76,h-180);
    const image=(img,x,y,w,h)=>{if(img.complete&&img.naturalWidth)ctx.drawImage(img,x,y,w,h);};
    const pet=(x,y,w,h)=>{if(r.pet.complete&&r.pet.naturalWidth)ctx.drawImage(r.pet,0,0,r.pet.naturalWidth/6,r.pet.naturalHeight/4,x,y,w,h);};
    if(r.id==='football'){
      pet(235,265,140,140);image(r.art,r.ball.x-31,r.ball.y-31,62,62);
      ctx.fillStyle='#fff2d9';ctx.font='16px system-ui';ctx.fillText(`Caídas: ${r.misses}`,22,35);
      ctx.fillStyle='#d9b877';ctx.fillText('Viento '+(Math.sin(r.time*(1.7+(r.level-1)*.18))>0?'→':'←'),465,35);
    }
    if(r.id==='skateboard'){
      ctx.fillStyle='#b87a38';ctx.fillRect(0,387,600,4);
      // Track marks move at obstacle speed, so the rider travels through the room.
      ctx.fillStyle='#d2ab652a';const track=(r.time*(220+(r.level-1)*32))%100;for(let x=-100;x<650;x+=100)ctx.fillRect(x-track,400,36,2);
      drawSkater(ctx,r);
      for(const o of r.obstacles){ctx.fillStyle='#bb8648';ctx.fillRect(o.x,344,45,43);ctx.strokeStyle='#6c4828';ctx.lineWidth=4;ctx.strokeRect(o.x+3,347,39,37);ctx.beginPath();ctx.moveTo(o.x+5,349);ctx.lineTo(o.x+40,381);ctx.stroke();}
    }
    if(r.id==='robot-vacuum'){
      for(const o of r.furniture){ctx.fillStyle='#141b27';ctx.fillRect(o.x-5,o.y+7,o.w+10,o.h+5);ctx.fillStyle='#765137';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.strokeStyle='#c58d52';ctx.lineWidth=3;ctx.strokeRect(o.x+4,o.y+4,o.w-8,o.h-8);}
      for(const c of r.crumbs)if(c.active){ctx.fillStyle='#e4bd6b';ctx.fillRect(c.x,c.y,6,5);ctx.fillRect(c.x+9,c.y+5,4,4);}
      for(let index=0;index<r.hazards.length;index++){
        const hazard=r.hazards[index];ctx.save();ctx.globalAlpha=Math.min(1,hazard.age/.7);ctx.fillStyle='#a99c88';for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(hazard.x+Math.cos(i+hazard.phase)*12,hazard.y+Math.sin(i+hazard.phase)*10,10,0,Math.PI*2);ctx.fill();}ctx.restore();
      }
      ctx.save();ctx.globalAlpha=r.invulnerable>0&&r.time>.9?.55+.35*Math.abs(Math.sin(r.time*20)):1;image(r.art,r.x-40,r.y-27,80,54);ctx.restore();
      if(r.drag!==null){ctx.strokeStyle='#f0d8a566';ctx.lineWidth=2;ctx.beginPath();ctx.arc(r.target.x,r.target.y,9,0,Math.PI*2);ctx.stroke();}
    }
    ctx.restore();
    if(roaming&&r.world.width>600){
      // A compact map shows offscreen crumbs while the camera follows the roomba.
      const scale=.105,mw=r.world.width*scale,mh=r.world.height*scale,mx=585-mw,my=14;
      ctx.save();ctx.fillStyle='#0d141ee8';ctx.fillRect(mx-5,my-5,mw+10,mh+10);ctx.strokeStyle='#e9c77e66';ctx.lineWidth=1;ctx.strokeRect(mx,my,mw,mh);
      ctx.fillStyle='#987a5c';for(const o of r.furniture)ctx.fillRect(mx+o.x*scale,my+o.y*scale,o.w*scale,o.h*scale);
      ctx.fillStyle='#e9c77e';for(const c of r.crumbs)if(c.active)ctx.fillRect(mx+c.x*scale-1,my+c.y*scale-1,2,2);
      ctx.strokeStyle='#cbd5e366';ctx.strokeRect(mx+r.camera.x*scale,my+r.camera.y*scale,600*scale,450*scale);ctx.fillStyle='#8ee2d4';ctx.beginPath();ctx.arc(mx+r.x*scale,my+r.y*scale,3,0,Math.PI*2);ctx.fill();ctx.restore();
    }
  }
  function drawSkater(ctx,r){
    const airborne=r.jump>0;
    const approach=r.obstacles.some(o=>o.x>205&&o.x<310);
    const landing=r.skateLanding>0?Math.sin(r.skateLanding/.25*Math.PI):0;
    const pop=airborne?Math.max(0,1-r.skateAir/.16):0;
    const tuck=airborne?Math.sin(Math.min(1,r.skateAir/.8)*Math.PI)*.38:0;
    const crouch=Math.min(1,(approach&&!airborne?.32:0)+landing*.85+pop*.8+tuck);
    const ride=airborne?0:Math.sin(r.time*13)*.8;
    // One local coordinate system keeps the shoes, deck and body together.
    const tilt=airborne?Math.max(-.2,Math.min(.16,-r.vy*.0004)):Math.sin(r.time*8)*.009;
    ctx.save();ctx.fillStyle=`rgba(0,0,0,${.27-r.jump*.0012})`;ctx.beginPath();ctx.ellipse(153,390,57-r.jump*.13,6-r.jump*.018,0,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.save();ctx.translate(153,375-r.jump+ride);ctx.rotate(tilt);
    // A side-on pixel deck gives both shoes a visible, level contact surface.
    for(const x of [-36,36]){
      ctx.fillStyle='#16151a';ctx.fillRect(x-4,1,8,5);ctx.fillStyle='#8e2020';ctx.beginPath();ctx.arc(x,5,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f16945';ctx.lineWidth=2;ctx.stroke();
      ctx.save();ctx.translate(x,5);ctx.rotate(r.time*22);ctx.strokeStyle='#f5bd92';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(3,0);ctx.moveTo(0,-3);ctx.lineTo(0,3);ctx.stroke();ctx.restore();
    }
    ctx.fillStyle='#a86d34';ctx.beginPath();ctx.moveTo(-60,-12);ctx.lineTo(-48,-7);ctx.lineTo(48,-7);ctx.lineTo(60,-12);ctx.lineTo(57,-7);ctx.lineTo(46,-2);ctx.lineTo(-46,-2);ctx.lineTo(-57,-7);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#29282d';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-58,-12);ctx.lineTo(-46,-8);ctx.lineTo(46,-8);ctx.lineTo(58,-12);ctx.stroke();
    const hipY=-51+crouch*15,lean=airborne?-5:Math.sin(r.time*3)*2;
    // Articulated jeans bend at the knee; the original Jordan pixels stay on deck.
    const leg=(hipX,kneeX,footX,colour)=>{
      ctx.lineJoin='bevel';ctx.lineCap='butt';ctx.strokeStyle='#182336';ctx.lineWidth=22;ctx.beginPath();ctx.moveTo(hipX+lean,hipY-5);ctx.lineTo(kneeX,hipY+18-crouch*5);ctx.lineTo(footX,-15);ctx.stroke();
      ctx.strokeStyle=colour;ctx.lineWidth=16;ctx.stroke();ctx.strokeStyle='#6390bb';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(hipX+lean-3,hipY);ctx.lineTo(kneeX-4,hipY+17-crouch*5);ctx.stroke();
    };
    leg(6,29+crouch*10,25,'#315b89');leg(-13,-27-crouch*12,-25,'#3f6d9e');
    if(r.pet.complete&&r.pet.naturalWidth){
      const fw=r.pet.naturalWidth/6,fh=r.pet.naturalHeight/4;
      const cut=(col,x,y,w,h,dx,dy,dw,dh)=>ctx.drawImage(r.pet,col*fw+x/256*fw,2*fh+y/256*fh,w/256*fw,h/256*fh,dx,dy,dw,dh);
      // Anticipation, balance in the air, and landing use distinct original poses.
      // Never crossfade pixel faces: one solid sprite stays sharp in every frame.
      ctx.save();ctx.translate(lean,hipY);ctx.rotate(airborne?-.07:Math.sin(r.time*4)*.015);
      if(crouch>.5)cut(1,26,44,200,158,-66,-88,112,88);
      else if(airborne)cut(2,26,18,200,170,-66,-95,112,95);
      else cut(0,26,24,200,162,-66,-91,112,91);
      ctx.restore();
      // Shoe samples from the idle sprite retain the mascot's exact footwear.
      ctx.drawImage(r.pet,82/256*fw,212/256*fh,54/256*fw,30/256*fh,-43,-23,34,18);
      ctx.drawImage(r.pet,139/256*fw,212/256*fh,61/256*fw,30/256*fh,10,-23,38,18);
    }
    ctx.restore();
    if(landing>.3){ctx.save();ctx.globalAlpha=landing*.35;ctx.strokeStyle='#dfb67d';ctx.lineWidth=2;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(153+side*49,384);ctx.lineTo(153+side*(61+(1-landing)*17),380);ctx.stroke();}ctx.restore();}
  }
  async function finish(r){
    if(round!==r)return;
    if(r.actor!==user()){close();return;}
    const score=r.score,token=r.token,actor=r.actor,game=r.id;stop();
    const best=save(game,score);
    const won=r.endReason==='goal';
    const outcome=won?`Nivel ${r.level} superado`:r.endReason==='dust'?'Sin vidas':r.endReason==='collision'?'Te has chocado':r.endReason==='time'?'Objetivo pendiente':'Partida terminada';
    body().innerHTML=`<section class="chota-arcade-result"><p>${outcome}</p><h2>${score}<small>de ${r.rules.goal} ${games[game].unit}</small></h2><p class="chota-arcade-result-level">Nivel ${r.level} · ${r.rules.name}</p><p>Tu mejor marca: <strong>${best}</strong></p><p data-reward>Guardando partida…</p><button type="button" class="chota-arcade-secondary" data-retry-save hidden>Reintentar guardado</button><div class="chota-arcade-results-actions">${won&&r.level<maxLevel?'<button type="button" data-next disabled>Guardando nivel…</button>':''}<button type="button" data-again>${won?'Repetir nivel':'Reintentar nivel'}</button><button type="button" class="chota-arcade-secondary" data-levels>Ver niveles</button></div>${won&&r.level===maxLevel?'<p>Has completado los cinco niveles.</p>':''}<div class="chota-arcade-ranking" data-ranking></div></section>`;
    body().querySelector('[data-again]').addEventListener('click',()=>start(game,r.level));body().querySelector('[data-levels]').addEventListener('click',()=>levels(game));body().querySelector('[data-next]')?.addEventListener('click',()=>start(game,r.level+1));
    const reward=body().querySelector('[data-reward]');
    const unlockNext=data=>{if(data?.level_completed){cacheProgress({...levelProgress,[game]:Math.max(Number(levelProgress[game])||0,Number(data.highest_completed)||r.level)});}const next=body()?.querySelector('[data-next]');if(next&&serial===token&&reward.isConnected&&unlocked(game)>r.level){next.disabled=false;next.textContent='Siguiente nivel';}};
    if(!config.submitScore&&!config.rpc){if(won)unlockNext({level_completed:true,highest_completed:r.level});reward.textContent='Partida guardada en este dispositivo.';return;}
    const ranking=body().querySelector('[data-ranking]');ranking.textContent='Cargando marcas del club…';
    const retry=body().querySelector('[data-retry-save]');
    let saving=false, confirmed=false;
    async function persist(){
    if(saving||user()!==actor)return;
    saving=true;retry.hidden=true;
    try{
      const sessionId=await r.serverSession;
      if(user()!==actor)return;
      if(!sessionId)throw new Error('No server session');
      const result=config.rpc?await rpc('submit_chota_level_score',{game_session_id:sessionId,submitted_score:score,completed_round:r.completed,level_won:won}):await config.submitScore(game,score,sessionId,r.completed);
      if(user()===actor){unlockNext(result);if(result?.reward_status==='awarded')void globalThis.DailyPacks?.refresh(true);}
      confirmed=true;
      if(result?.reward_status==='awarded'){if(reward.isConnected)reward.textContent='¡1 sobre ganado! Ya está en tus sobres.';}
      else if(result?.reward_status==='already_claimed'){if(reward.isConnected)reward.textContent='Ya tienes el sobre de este juego de hoy. Vuelve mañana por otro.';}
      else if(reward.isConnected)reward.textContent=r.completed?'Partida guardada. El sobre diario requiere al menos 12 segundos de juego.':'Partida guardada. Termina un nivel para conseguir el sobre diario.';
      if(serial!==token||user()!==actor||!ranking.isConnected)return;
      if(!config.leaderboard){ranking.textContent='';return;}
      const rows=await config.leaderboard(game);
      if(serial!==token||user()!==actor||!ranking.isConnected)return;
      const valid=(Array.isArray(rows)?rows:[]).filter(row=>Number.isFinite(Number(row.score))).slice(0,5);
      ranking.innerHTML=`<h3>Marcas del club</h3>${valid.length?`<ol>${valid.map(row=>`<li><span>${esc(row.name||'Miembro')}</span><strong>${Math.max(0,Math.floor(Number(row.score)))}</strong></li>`).join('')}</ol>`:'<p>Aún no hay marcas compartidas.</p>'}`;
    }catch{if(!confirmed&&reward.isConnected){reward.textContent='No se pudo confirmar el sobre. Reintenta guardar esta partida.';retry.hidden=false;}if(ranking.isConnected)ranking.textContent='Tu marca está guardada en este dispositivo. El ranking no está disponible ahora.';}
    finally{saving=false;}
    }
    retry.addEventListener('click',persist);
    await persist();
  }
  function initialize(options={}){config=options;}
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&round){round.endReason='abandoned';finish(round);}});
  globalThis.ChotaGames=Object.freeze({initialize,mount,open,mountWeeklyChallenge:weeklyChallenge,reset:()=>close({immediate:true})});
})();
