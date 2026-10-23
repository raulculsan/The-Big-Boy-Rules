/* Short, deliberately local arcade sessions. Scores never mint currency or packs. */
(() => {
  'use strict';
  const games = {
    football: {name:'Toques en la sede',item:'Pelota',art:'football-v2.png',help:'Toca el balón antes de que caiga. Cada toque lo vuelve a lanzar. Tienes 30 segundos.'},
    skateboard: {name:'Salta con El Chota',item:'Skate',art:'skateboard-v2.png',help:'Toca la pista para saltar las cajas. Cada caja superada suma un punto. Tienes 30 segundos.'},
    'robot-vacuum': {name:'La última miga',item:'Roomba',art:'robot-vacuum-v2.png',help:'Arrastra la roomba por la alfombra y recoge las 20 migas. Tienes 30 segundos.'}
  };
  let config = {}, dialog = null, round = null, frame = 0, root = null, previousFocus = null, serial = 0;
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
    root.innerHTML='<button type="button" data-chota-arcade><img src="icons/clubhouse/props/football-v2.png" alt="" loading="lazy" draggable="false"><span><strong>Un rato con El Chota</strong><small>Pelota, skate y marcas personales</small></span><span class="chota-arcade-entry-action">Jugar</span></button>';
    root.querySelector('button').addEventListener('click',open);
  }
  function stop(){cancelAnimationFrame(frame);frame=0;round=null;}
  function close(){serial++;stop();if(dialog){dialog.close();dialog.remove();dialog=null;}previousFocus?.focus?.({preventScroll:true});}
  async function open(){
    if(dialog)return;
    previousFocus=document.activeElement;
    dialog=document.createElement('dialog');dialog.className='chota-arcade';dialog.setAttribute('aria-label','Minijuegos de El Chota');
    dialog.innerHTML='<div class="chota-arcade-shell"><header><span>La sede · El Chota</span><button type="button" data-arcade-close aria-label="Cerrar minijuegos">Cerrar</button></header><div data-arcade-body aria-live="polite"><p>Cargando sus objetos…</p></div></div>';
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
    try{inventory=await owned();}catch{inventory=new Set();}
    if(token!==serial||actor!==user()||!dialog)return;
    const best=scores();
    body().innerHTML=`<div class="chota-arcade-intro"><h2>¿Una partida?</h2><p>Los objetos de su habitación también se juegan.</p></div><div class="chota-arcade-games">${Object.entries(games).map(([id,g])=>`<button class="chota-arcade-game" type="button" data-game="${id}" ${inventory.has(id)?'':'data-locked="true"'}><img src="icons/clubhouse/props/${g.art}" alt="" draggable="false"><span><strong>${g.name}</strong><small>${inventory.has(id)?`Tu marca: ${Number(best[id])||0} · 30 s`:`Consigue ${g.item.toLowerCase()} en la tienda`}</small></span><b>${inventory.has(id)?'Jugar':'Tienda'}</b></button>`).join('')}</div><p class="chota-arcade-footnote">Partidas rápidas, sin gastar monedas.</p>`;
    body().querySelectorAll('[data-game]').forEach(button=>button.addEventListener('click',()=>{
      if(button.dataset.locked){if(config.openShop){close();config.openShop();}else{body().querySelector('.chota-arcade-footnote').textContent='Encontrarás sus objetos en Tienda → El Chota.';}return;}
      briefing(button.dataset.game);
    }));
  }
  const body=()=>dialog?.querySelector('[data-arcade-body]');
  function briefing(id){
    const g=games[id];
    body().innerHTML=`<section class="chota-arcade-brief"><img src="icons/clubhouse/props/${g.art}" alt="" draggable="false"><h2>${g.name}</h2><p>${g.help}</p><button type="button" data-start>Empezar</button><button type="button" class="chota-arcade-secondary" data-menu>Volver a los juegos</button></section>`;
    body().querySelector('[data-start]').addEventListener('click',()=>start(id));
    body().querySelector('[data-menu]').addEventListener('click',menu);
  }
  function start(id){
    stop();const token=++serial;
    body().innerHTML=`<div class="chota-arcade-score"><div><span>Puntos</span><strong data-score>0</strong></div><h2>${games[id].name}</h2><div><span>Tiempo</span><strong data-clock>30</strong></div></div><div class="chota-arcade-stage" role="application" aria-label="${esc(games[id].help)}" tabindex="0"><canvas aria-label="Zona de juego"></canvas><span class="chota-arcade-hint">${id==='football'?'Toca el balón':id==='skateboard'?'Toca para saltar':'Arrastra para limpiar'}</span></div><button type="button" class="chota-arcade-secondary" data-abandon>Terminar partida</button>`;
    const stage=body().querySelector('.chota-arcade-stage'), canvas=stage.querySelector('canvas'),ctx=canvas.getContext('2d');
    if(!ctx){briefing(id);return;}
    const dpr=Math.min(devicePixelRatio||1,2);canvas.width=600*dpr;canvas.height=450*dpr;ctx.scale(dpr,dpr);ctx.imageSmoothingEnabled=false;
    const r=round={id,token,actor:user(),score:0,time:0,last:0,ball:{x:300,y:160,vy:0,vx:20},jump:0,vy:0,x:300,y:300,obstacles:[],spawn:.5,cleared:0,drag:null,crumbs:Array.from({length:20},(_,i)=>({x:65+(i%5)*115+Math.random()*20,y:125+Math.floor(i/5)*75+Math.random()*20,active:true}))};
    r.serverSession=config.startGame?Promise.resolve().then(()=>config.startGame(id)).catch(()=>null):Promise.resolve(null);
    r.art=new Image();r.art.src=`icons/clubhouse/props/${games[id].art}`;r.pet=new Image();r.pet.src='icons/mascot/chota-v2/chota-poses.webp';
    const point=e=>{const b=canvas.getBoundingClientRect();return{x:(e.clientX-b.left)/b.width*600,y:(e.clientY-b.top)/b.height*450};};
    function act(e){
      if(round!==r)return;
      if(e.type==='keydown'&&![' ','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
      if(e.type==='keydown'&&id==='robot-vacuum'){e.preventDefault();r.x=Math.max(38,Math.min(562,r.x+(e.key==='ArrowRight'?24:e.key==='ArrowLeft'?-24:0)));r.y=Math.max(110,Math.min(408,r.y+(e.key==='ArrowDown'?24:e.key==='ArrowUp'?-24:0)));return;}
      e.preventDefault();const p=e.type==='keydown'?{x:r.ball.x,y:r.ball.y}:point(e);
      if(id==='football'&&Math.hypot(p.x-r.ball.x,p.y-r.ball.y)<62){r.ball.vy=-330-Math.min(r.score*4,120);r.ball.vx=(r.ball.x-p.x)*4+(Math.random()-.5)*70;r.score++;}
      else if(id==='skateboard'&&r.jump===0){r.vy=500;r.jump=1;}
      else if(id==='robot-vacuum'){r.drag=e.pointerId;stage.setPointerCapture?.(e.pointerId);r.x=Math.max(38,Math.min(562,p.x));r.y=Math.max(110,Math.min(408,p.y));}
    }
    stage.addEventListener('pointerdown',act);stage.addEventListener('keydown',act);
    stage.addEventListener('pointermove',e=>{if(round===r&&r.drag===e.pointerId){e.preventDefault();const p=point(e);r.x=Math.max(38,Math.min(562,p.x));r.y=Math.max(110,Math.min(408,p.y));}});
    stage.addEventListener('pointerup',()=>{r.drag=null;});stage.addEventListener('pointercancel',()=>{r.drag=null;});
    body().querySelector('[data-abandon]').addEventListener('click',()=>finish(r));stage.focus({preventScroll:true});
    const scoreLabel=body().querySelector('[data-score]'),clockLabel=body().querySelector('[data-clock]');
    const loop=now=>{
      if(round!==r||token!==serial||!dialog)return;
      if(r.actor!==user()){close();return;}
      const dt=r.last?Math.min((now-r.last)/1000,.04):0;r.last=now;r.time+=dt;
      update(r,dt);if(round!==r)return;draw(ctx,r);
      if(scoreLabel.textContent!==String(r.score))scoreLabel.textContent=String(r.score);
      const seconds=String(Math.max(0,Math.ceil(30-r.time)));if(clockLabel.textContent!==seconds)clockLabel.textContent=seconds;
      if(r.time>=30||(id==='football'&&r.ball.y>490)||(id==='robot-vacuum'&&r.score===20)){finish(r);return;}
      frame=requestAnimationFrame(loop);
    };frame=requestAnimationFrame(loop);
  }
  function update(r,dt){
    if(r.id==='football'){r.ball.vy+=470*dt;r.ball.y+=r.ball.vy*dt;r.ball.x+=r.ball.vx*dt;if(r.ball.x<30||r.ball.x>570){r.ball.x=Math.max(30,Math.min(570,r.ball.x));r.ball.vx*=-1;}}
    if(r.id==='skateboard'){
      if(r.jump>0){r.vy-=1200*dt;r.jump=Math.max(0,r.jump+r.vy*dt);}
      r.spawn-=dt;if(r.spawn<=0){r.obstacles.push({x:660,passed:false});r.spawn=1.15+Math.random()*.6;}
      for(const o of r.obstacles){o.x-=(220+r.time*3)*dt;if(!o.passed&&o.x<110){o.passed=true;r.score++;}if(o.x<184&&o.x>112&&r.jump<43){finish(r);return;}}
      r.obstacles=r.obstacles.filter(o=>o.x>-50);
    }
    if(r.id==='robot-vacuum')for(const c of r.crumbs){if(c.active&&Math.hypot(c.x-r.x,c.y-r.y)<36){c.active=false;r.score++;}}
  }
  function draw(ctx,r){
    ctx.clearRect(0,0,600,450);ctx.fillStyle='#252c31';ctx.fillRect(0,0,600,450);ctx.fillStyle='#59412e';ctx.fillRect(0,100,600,350);
    ctx.strokeStyle='#433121';ctx.lineWidth=3;for(let y=110;y<450;y+=38){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(600,y);ctx.stroke();}for(let x=0;x<600;x+=95){ctx.beginPath();ctx.moveTo(x,100);ctx.lineTo(x+80,450);ctx.stroke();}
    ctx.fillStyle='#252e44';ctx.fillRect(28,120,544,290);ctx.strokeStyle='#b87a38';ctx.lineWidth=5;ctx.strokeRect(38,130,524,270);
    const image=(img,x,y,w,h)=>{if(img.complete&&img.naturalWidth)ctx.drawImage(img,x,y,w,h);};
    const pet=(x,y,w,h)=>{if(r.pet.complete&&r.pet.naturalWidth)ctx.drawImage(r.pet,0,0,r.pet.naturalWidth/6,r.pet.naturalHeight/4,x,y,w,h);};
    if(r.id==='football'){pet(235,265,140,140);image(r.art,r.ball.x-31,r.ball.y-31,62,62);}
    if(r.id==='skateboard'){
      ctx.fillStyle='#b87a38';ctx.fillRect(0,387,600,4);pet(98,255-r.jump,112,112);image(r.art,90,351-r.jump,120,62);
      for(const o of r.obstacles){ctx.fillStyle='#bb8648';ctx.fillRect(o.x,344,45,43);ctx.strokeStyle='#6c4828';ctx.lineWidth=4;ctx.strokeRect(o.x+3,347,39,37);ctx.beginPath();ctx.moveTo(o.x+5,349);ctx.lineTo(o.x+40,381);ctx.stroke();}
    }
    if(r.id==='robot-vacuum'){
      for(const c of r.crumbs)if(c.active){ctx.fillStyle='#e4bd6b';ctx.fillRect(c.x,c.y,6,5);ctx.fillRect(c.x+9,c.y+5,4,4);}
      image(r.art,r.x-48,r.y-32,96,64);
    }
  }
  async function finish(r){
    if(round!==r)return;
    if(r.actor!==user()){close();return;}
    const score=r.score,token=r.token,actor=r.actor,game=r.id;stop();
    const best=save(game,score);
    body().innerHTML=`<section class="chota-arcade-result"><p>${game==='robot-vacuum'&&score===20?'Alfombra impecable':'Fin de la partida'}</p><h2>${score}<small>${game==='robot-vacuum'?'migas':game==='football'?'toques':'saltos'}</small></h2><p>Tu mejor marca: <strong>${best}</strong></p><div class="chota-arcade-results-actions"><button type="button" data-again>Otra partida</button><button type="button" class="chota-arcade-secondary" data-menu>Ver juegos</button></div><div class="chota-arcade-ranking" data-ranking></div></section>`;
    body().querySelector('[data-again]').addEventListener('click',()=>briefing(game));body().querySelector('[data-menu]').addEventListener('click',menu);
    if(!config.leaderboard)return;
    const ranking=body().querySelector('[data-ranking]');ranking.textContent='Cargando marcas del club…';
    try{
      const sessionId=await r.serverSession;
      if(serial!==token||user()!==actor||!ranking.isConnected)return;
      if(config.submitScore&&sessionId)await config.submitScore(game,score,sessionId);
      if(serial!==token||user()!==actor||!ranking.isConnected)return;
      const rows=await config.leaderboard(game);
      if(serial!==token||user()!==actor||!ranking.isConnected)return;
      const valid=(Array.isArray(rows)?rows:[]).filter(row=>Number.isFinite(Number(row.score))).slice(0,5);
      ranking.innerHTML=`<h3>Marcas del club</h3>${valid.length?`<ol>${valid.map(row=>`<li><span>${esc(row.name||'Miembro')}</span><strong>${Math.max(0,Math.floor(Number(row.score)))}</strong></li>`).join('')}</ol>`:'<p>Aún no hay marcas compartidas.</p>'}`;
    }catch{if(ranking.isConnected)ranking.textContent='Tu marca está guardada en este dispositivo. El ranking no está disponible ahora.';}
  }
  function initialize(options={}){config=options;}
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&round)finish(round);});
  globalThis.ChotaGames=Object.freeze({initialize,mount,open,reset:close});
})();
