/* Short arcade sessions. Daily packs are validated and granted by the server. */
(() => {
  'use strict';
  const games = {
    football: {name:'Toques en la sede',item:'Pelota',art:'football-v2.png',help:'Toca el balón para mantenerlo en el aire. El lado que toques cambia su dirección. Suma todos los toques que puedas en 30 segundos.'},
    skateboard: {name:'Salta con El Chota',item:'Skate',art:'skateboard-v2.png',help:'Toca la pista para saltar las cajas. Cada caja superada suma un punto. Tienes 30 segundos.'},
    'robot-vacuum': {name:'La última miga',item:'Roomba',art:'robot-vacuum-v2.png',help:'Arrastra para guiar la roomba. Esquiva los muebles y la bola de polvo, que te frena. Recoge 30 migas en 30 segundos.'}
  };
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
  function close(){serial++;stop();if(dialog){dialog.close();dialog.remove();dialog=null;}previousFocus?.focus?.({preventScroll:true});}
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
    try{inventory=await owned();}catch{inventory=new Set();}
    if(token!==serial||actor!==user()||!dialog)return;
    const best=scores();
    body().innerHTML=`<div class="chota-arcade-games">${Object.entries(games).map(([id,g])=>`<button class="chota-arcade-game" type="button" data-game="${id}" aria-describedby="chotaGameHelpHint" ${inventory.has(id)?'':'data-locked="true"'}><img src="icons/clubhouse/props/${g.art}" alt="" draggable="false"><span><strong>${g.name}</strong><small>${inventory.has(id)?`Récord ${Number(best[id])||0} · 30 s`:`Necesitas ${g.item.toLowerCase()}`}</small></span><b>${inventory.has(id)?'Jugar':'Tienda'}</b></button>`).join('')}</div><div class="chota-arcade-menu-note"><p>1 sobre por juego al día</p><p id="chotaGameHelpHint">Mantén pulsado un juego para ver cómo jugar.</p></div>`;
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
        start(button.dataset.game);
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
    body().querySelector('[data-start]')?.addEventListener('click',()=>start(id));
    body().querySelector('[data-menu]').addEventListener('click',menu);
    body().querySelector('h2').focus({preventScroll:true});
  }
  function start(id){
    stop();const token=++serial;
    body().innerHTML=`<div class="chota-arcade-score"><div><span>Puntos</span><strong data-score>0</strong></div><h2>${games[id].name}</h2><div><span>Tiempo</span><strong data-clock>30</strong></div></div><div class="chota-arcade-stage" role="application" aria-label="${esc(games[id].help)}" tabindex="0"><canvas aria-label="Zona de juego"></canvas><span class="chota-arcade-hint">${id==='football'?'Toca el balón':id==='skateboard'?'Toca para saltar':'Arrastra para limpiar'}</span></div><button type="button" class="chota-arcade-secondary" data-abandon>Terminar partida</button>`;
    const stage=body().querySelector('.chota-arcade-stage'), canvas=stage.querySelector('canvas'),ctx=canvas.getContext('2d');
    if(!ctx){briefing(id);return;}
    const dpr=Math.min(devicePixelRatio||1,2);canvas.width=600*dpr;canvas.height=450*dpr;ctx.scale(dpr,dpr);ctx.imageSmoothingEnabled=false;
    const r=round={id,token,actor:user(),score:0,time:0,last:0,completed:false,lastHit:-1,misses:0,ball:{x:300,y:140,vy:0,vx:85},jump:0,vy:0,skateAir:0,skateLanding:0,x:300,y:370,target:{x:300,y:370},stunned:0,hazardHit:-2,furniture:[{x:126,y:205,w:76,h:72},{x:366,y:280,w:98,h:55},{x:390,y:132,w:62,h:65}],obstacles:[],spawn:.5,cleared:0,drag:null,crumbs:[]};
    r.crumbs=Array.from({length:30},()=>{let c;do{c={x:55+Math.random()*490,y:145+Math.random()*245,active:true};}while(r.furniture.some(o=>c.x>o.x-28&&c.x<o.x+o.w+28&&c.y>o.y-28&&c.y<o.y+o.h+28));return c;});
    r.serverSession=config.startGame?Promise.resolve().then(()=>config.startGame(id)).catch(()=>null):Promise.resolve(null);
    r.art=new Image();r.art.src=`icons/clubhouse/props/${games[id].art}`;r.pet=new Image();r.pet.src='icons/mascot/chota-v2/chota-poses.webp';
    const point=e=>{const b=canvas.getBoundingClientRect();return{x:(e.clientX-b.left)/b.width*600,y:(e.clientY-b.top)/b.height*450};};
    function act(e){
      if(round!==r)return;
      if(e.type==='keydown'&&![' ','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
      if(e.type==='keydown'&&id==='robot-vacuum'){e.preventDefault();r.target.x=Math.max(52,Math.min(548,r.target.x+(e.key==='ArrowRight'?45:e.key==='ArrowLeft'?-45:0)));r.target.y=Math.max(145,Math.min(390,r.target.y+(e.key==='ArrowDown'?45:e.key==='ArrowUp'?-45:0)));return;}
      e.preventDefault();const p=e.type==='keydown'?{x:r.ball.x,y:r.ball.y}:point(e);
      if(id==='football'&&r.time-r.lastHit>.26&&Math.hypot(p.x-r.ball.x,p.y-r.ball.y)<46){r.lastHit=r.time;r.ball.vy=-380-Math.min(r.time*5,120);r.ball.vx=Math.max(-240,Math.min(240,r.ball.vx*.45+(r.ball.x-p.x)*6+(Math.random()-.5)*65));r.score++;}
      else if(id==='skateboard'&&r.jump===0){r.vy=500;r.jump=1;r.skateAir=0;r.skateLanding=0;}
      else if(id==='robot-vacuum'){r.drag=e.pointerId;stage.setPointerCapture?.(e.pointerId);r.target.x=Math.max(52,Math.min(548,p.x));r.target.y=Math.max(145,Math.min(390,p.y));}
    }
    stage.addEventListener('pointerdown',act);stage.addEventListener('keydown',act);
    stage.addEventListener('pointermove',e=>{if(round===r&&r.drag===e.pointerId){e.preventDefault();const p=point(e);r.target.x=Math.max(52,Math.min(548,p.x));r.target.y=Math.max(145,Math.min(390,p.y));}});
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
      if(r.time>=30||(id==='robot-vacuum'&&r.score===30)){r.completed=true;finish(r);return;}
      frame=requestAnimationFrame(loop);
    };frame=requestAnimationFrame(loop);
  }
  function update(r,dt){
    if(r.id==='football'){
      r.ball.vy+=(610+r.time*6)*dt;
      r.ball.vx+=Math.sin(r.time*1.7)*(36+r.time*2)*dt;
      r.ball.y+=r.ball.vy*dt;r.ball.x+=r.ball.vx*dt;
      if(r.ball.x<30||r.ball.x>570){r.ball.x=Math.max(30,Math.min(570,r.ball.x));r.ball.vx*=-.92;}
      if(r.ball.y<34){r.ball.y=34;r.ball.vy=Math.abs(r.ball.vy)*.55;}
      if(r.ball.y>485){r.misses++;r.ball={x:160+Math.random()*280,y:130,vy:0,vx:(Math.random()<.5?-1:1)*(90+r.time*3)};}
    }
    if(r.id==='skateboard'){
      r.skateLanding=Math.max(0,r.skateLanding-dt);
      if(r.jump>0){r.skateAir+=dt;r.vy-=1200*dt;r.jump=Math.max(0,r.jump+r.vy*dt);if(r.jump===0){r.skateLanding=.25;r.vy=0;}}
      r.spawn-=dt;if(r.spawn<=0){r.obstacles.push({x:660,passed:false});r.spawn=1.15+Math.random()*.6;}
      for(const o of r.obstacles){o.x-=(220+r.time*3)*dt;if(!o.passed&&o.x<110){o.passed=true;r.score++;}if(o.x<184&&o.x>112&&r.jump<43){r.completed=true;finish(r);return;}}
      r.obstacles=r.obstacles.filter(o=>o.x>-50);
    }
    if(r.id==='robot-vacuum'){
      r.stunned=Math.max(0,r.stunned-dt);
      const distance=Math.hypot(r.target.x-r.x,r.target.y-r.y),step=Math.min(distance,(r.stunned>0?65:210)*dt);
      if(distance>1){
        const dx=(r.target.x-r.x)/distance*step,dy=(r.target.y-r.y)/distance*step;
        const blocked=(x,y)=>r.furniture.some(o=>x>o.x-28&&x<o.x+o.w+28&&y>o.y-21&&y<o.y+o.h+21);
        if(!blocked(r.x+dx,r.y))r.x+=dx;
        if(!blocked(r.x,r.y+dy))r.y+=dy;
      }
      const hazard={x:300+Math.sin(r.time*1.1)*218,y:250+Math.cos(r.time*1.65)*95};
      if(Math.hypot(hazard.x-r.x,hazard.y-r.y)<42&&r.time-r.hazardHit>1.5){r.hazardHit=r.time;r.stunned=1.2;}
      for(const c of r.crumbs)if(c.active&&Math.hypot(c.x-r.x,c.y-r.y)<25){c.active=false;r.score++;}
    }
  }
  function draw(ctx,r){
    ctx.clearRect(0,0,600,450);ctx.fillStyle='#252c31';ctx.fillRect(0,0,600,450);ctx.fillStyle='#59412e';ctx.fillRect(0,100,600,350);
    ctx.strokeStyle='#433121';ctx.lineWidth=3;for(let y=110;y<450;y+=38){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(600,y);ctx.stroke();}for(let x=0;x<600;x+=95){ctx.beginPath();ctx.moveTo(x,100);ctx.lineTo(x+80,450);ctx.stroke();}
    ctx.fillStyle='#252e44';ctx.fillRect(28,120,544,290);ctx.strokeStyle='#b87a38';ctx.lineWidth=5;ctx.strokeRect(38,130,524,270);
    const image=(img,x,y,w,h)=>{if(img.complete&&img.naturalWidth)ctx.drawImage(img,x,y,w,h);};
    const pet=(x,y,w,h)=>{if(r.pet.complete&&r.pet.naturalWidth)ctx.drawImage(r.pet,0,0,r.pet.naturalWidth/6,r.pet.naturalHeight/4,x,y,w,h);};
    if(r.id==='football'){
      pet(235,265,140,140);image(r.art,r.ball.x-31,r.ball.y-31,62,62);
      ctx.fillStyle='#fff2d9';ctx.font='16px system-ui';ctx.fillText(`Caídas: ${r.misses}`,22,35);
      ctx.fillStyle='#d9b877';ctx.fillText('Viento '+(Math.sin(r.time*1.7)>0?'→':'←'),465,35);
    }
    if(r.id==='skateboard'){
      ctx.fillStyle='#b87a38';ctx.fillRect(0,387,600,4);
      // Track marks move at obstacle speed, so the rider travels through the room.
      ctx.fillStyle='#d2ab652a';const track=(r.time*240)%100;for(let x=-100;x<650;x+=100)ctx.fillRect(x-track,400,36,2);
      drawSkater(ctx,r);
      for(const o of r.obstacles){ctx.fillStyle='#bb8648';ctx.fillRect(o.x,344,45,43);ctx.strokeStyle='#6c4828';ctx.lineWidth=4;ctx.strokeRect(o.x+3,347,39,37);ctx.beginPath();ctx.moveTo(o.x+5,349);ctx.lineTo(o.x+40,381);ctx.stroke();}
    }
    if(r.id==='robot-vacuum'){
      for(const o of r.furniture){ctx.fillStyle='#141b27';ctx.fillRect(o.x-5,o.y+7,o.w+10,o.h+5);ctx.fillStyle='#765137';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.strokeStyle='#c58d52';ctx.lineWidth=3;ctx.strokeRect(o.x+4,o.y+4,o.w-8,o.h-8);}
      for(const c of r.crumbs)if(c.active){ctx.fillStyle='#e4bd6b';ctx.fillRect(c.x,c.y,6,5);ctx.fillRect(c.x+9,c.y+5,4,4);}
      const hx=300+Math.sin(r.time*1.1)*218,hy=250+Math.cos(r.time*1.65)*95;
      ctx.fillStyle='#a99c88';for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(hx+Math.cos(i)*12,hy+Math.sin(i)*10,10,0,Math.PI*2);ctx.fill();}
      ctx.save();ctx.globalAlpha=r.stunned>0?.6+.3*Math.sin(r.time*25):1;image(r.art,r.x-40,r.y-27,80,54);ctx.restore();
      if(r.drag!==null){ctx.strokeStyle='#f0d8a566';ctx.lineWidth=2;ctx.beginPath();ctx.arc(r.target.x,r.target.y,9,0,Math.PI*2);ctx.stroke();}
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
    body().innerHTML=`<section class="chota-arcade-result"><p>${game==='robot-vacuum'&&score===30?'Alfombra impecable':'Fin de la partida'}</p><h2>${score}<small>${game==='robot-vacuum'?'migas':game==='football'?'toques':'saltos'}</small></h2><p>Tu mejor marca: <strong>${best}</strong></p><p data-reward>Comprobando recompensa diaria…</p><button type="button" class="chota-arcade-secondary" data-retry-save hidden>Reintentar guardado</button><div class="chota-arcade-results-actions"><button type="button" data-again>Otra partida</button><button type="button" class="chota-arcade-secondary" data-menu>Ver juegos</button></div><div class="chota-arcade-ranking" data-ranking></div></section>`;
    body().querySelector('[data-again]').addEventListener('click',()=>start(game));body().querySelector('[data-menu]').addEventListener('click',menu);
    const reward=body().querySelector('[data-reward]');
    if(!config.submitScore){reward.textContent='Completa una partida con conexión para ganar tu sobre diario.';return;}
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
      const result=await config.submitScore(game,score,sessionId,r.completed);
      confirmed=true;
      if(result?.reward_status==='awarded'){if(reward.isConnected)reward.textContent='¡1 sobre ganado! Ya está en tus sobres.';}
      else if(result?.reward_status==='already_claimed'){if(reward.isConnected)reward.textContent='Ya tienes el sobre de este juego de hoy. Vuelve mañana por otro.';}
      else if(reward.isConnected)reward.textContent=r.completed?'Juega al menos 12 segundos para conseguir el sobre diario.':'Completa la partida para conseguir el sobre diario.';
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
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&round)finish(round);});
  globalThis.ChotaGames=Object.freeze({initialize,mount,open,mountWeeklyChallenge:weeklyChallenge,reset:close});
})();
