/* Extracted from current app.js for local QA; not a replacement runtime. */
function chotaLifeCatalog() {
  return {
    "ear-flick-left":{family:"ears",cooldown:70000,familyCooldown:20000,duration:1550},
    "ear-flick-right":{family:"ears",cooldown:75000,familyCooldown:20000,duration:1700},
    "ear-scan":{family:"ears",cooldown:130000,familyCooldown:24000,duration:3400},
    "tail-sway":{family:"tail",cooldown:90000,familyCooldown:22000,duration:3700},
    "deep-breath":{family:"posture",cooldown:180000,familyCooldown:38000,duration:5200},
    "shake-off":{family:"reflex",cooldown:240000,familyCooldown:120000,duration:2300},
    "soft-blink":{family:"face",cooldown:95000,familyCooldown:23000,duration:2700},
    "paw-relax":{family:"selfcare",cooldown:150000,familyCooldown:34000,duration:3200},
    listen:{family:"orient",cooldown:95000,familyCooldown:26000,duration:3100},
    balance:{family:"posture",cooldown:125000,familyCooldown:38000,duration:3600},
    "check-tail":{family:"selfcare",cooldown:135000,familyCooldown:34000,duration:3400},
    "check-shoes":{family:"selfcare",cooldown:150000,familyCooldown:34000,duration:3200},
    sneeze:{family:"reflex",cooldown:240000,familyCooldown:120000,duration:1900},
    drowsy:{family:"rest",cooldown:180000,familyCooldown:95000,duration:4200},
  };
}
function chotaAttentionFamily(action) {
  return chotaLifeCatalog()[action]?.family || ({roomba:"orient",window:"orient",look:"orient",ears:"orient",tail:"selfcare",scratch:"selfcare",shirt:"selfcare",stretch:"posture",settle:"posture",plan:"orient"})[action] || action;
}
function chotaChooseLifeAction({now,moment,lastAction,times,families,lastTouchAt,outdoor=false,random=Math.random()}) {
  if(now-lastTouchAt<12000) return null;
  const choices=Object.entries(chotaLifeCatalog()).filter(([action,info])=>action!==lastAction &&
    (action!=="drowsy" || ["evening","night"].includes(moment)) &&
    now-(times.get(action)??-Infinity)>=info.cooldown && now-(families.get(info.family)??-Infinity)>=info.familyCooldown).map(([action])=>action);
  if(outdoor && choices.includes("listen")) return "listen";
  // Randomize among the three most rested eligible gestures: variety without a fixed cycle.
  const ages=choices.map(action=>times.get(action)??-Infinity).sort((a,b)=>a-b);
  const cutoff=ages[Math.min(2,ages.length-1)];
  const rested=choices.filter(action=>(times.get(action)??-Infinity)<=cutoff);
  return rested[Math.min(rested.length-1,Math.floor(random*rested.length))] || null;
}
function chotaLifeTracks(action, direction=1) {
  const t=(x=0,y=0,r=0)=>`translate(${x}%,${y}%) rotate(${r}deg)`;
  const track=points=>points.map(([offset,transform])=>({offset,transform,easing:"ease-in-out"}));
  const blink=points=>points.map(([offset,opacity])=>({offset,opacity,easing:"ease-in-out"}));
  const d=direction;
  // Local articulation: none of these tracks moves the actor or contact shoes.
  if(action==="ear-flick-left" || action==="ear-flick-right") {
    const left=action==="ear-flick-left", sign=left?-1:1;
    return {[left?"leftEar":"rightEar"]:track([[0,t()],[.16,t()],[.24,t(0,0,8*sign)],[.36,t(0,0,-3*sign)],[.5,t(0,0,3*sign)],[.7,t()],[1,t()]]),
      tail:track([[0,t()],[.6,t(0,0,-1.2)],[1,t()]])};
  }
  if(action==="ear-scan") return {
    leftEar:track([[0,t()],[.15,t(0,0,-8)],[.34,t(0,0,-8)],[.55,t(0,0,2)],[.8,t()],[1,t()]]),
    rightEar:track([[0,t()],[.3,t()],[.45,t(0,0,8)],[.69,t(0,0,5)],[.88,t(0,0,-1)],[1,t()]]),
    head:track([[0,t()],[.39,t()],[.58,t(.3,-.15,.7)],[.8,t(.3,-.15,.7)],[1,t()]]),
    tail:track([[0,t()],[.65,t(0,0,-2)],[1,t()]])};
  if(action==="tail-sway") return {
    tail:track([[0,t()],[.17,t(0,0,-4.5)],[.33,t(0,0,-2)],[.48,t(0,0,-5.5)],[.65,t(0,0,-3)],[.84,t(0,0,-1)],[1,t()]]),
    leftEar:track([[0,t()],[.55,t()],[.69,t(0,0,-2)],[1,t()]])};
  if(action==="deep-breath") return {
    body:track([[0,"scale(1)"],[.35,"scale(1.006,1.014)"],[.46,"scale(1.006,1.014)"],[.82,"scale(1)"],[1,"scale(1)"]]),
    head:track([[0,t()],[.35,t(0,-.35,-.45)],[.46,t(0,-.35,-.45)],[.82,t(0,.15,.3)],[1,t()]]),
    leftEar:track([[0,t()],[.6,t(0,0,2.4)],[1,t()]]),
    rightEar:track([[0,t()],[.65,t(0,0,-2)],[1,t()]]),
    lids:blink([[0,0],[.21,0],[.33,1],[.52,1],[.69,0],[1,0]])};
  if(action==="shake-off") return {
    head:track([[0,t()],[.14,t(0,.15,.6)],[.28,t(-.3,0,-2.2)],[.38,t(.3,0,2)],[.48,t(-.2,0,-1.3)],[.59,t(.15,0,.7)],[.74,t()],[1,t()]]),
    leftEar:track([[0,t()],[.27,t(0,0,5)],[.39,t(0,0,-6)],[.5,t(0,0,4)],[.64,t(0,0,-2)],[.82,t()],[1,t()]]),
    rightEar:track([[0,t()],[.31,t(0,0,6)],[.43,t(0,0,-5)],[.54,t(0,0,3)],[.68,t(0,0,-1)],[.86,t()],[1,t()]]),
    tail:track([[0,t()],[.4,t(0,0,-4)],[.64,t(0,0,2)],[1,t()]]),
    lids:blink([[0,0],[.18,0],[.27,1],[.62,1],[.78,0],[1,0]])};
  if(action==="soft-blink") return {
    lids:blink([[0,0],[.15,0],[.25,1],[.42,1],[.55,0],[.66,0],[.72,1],[.8,0],[1,0]]),
    head:track([[0,t()],[.36,t(0,.25,.45)],[.61,t(0,.25,.45)],[1,t()]]),
    leftEar:track([[0,t()],[.4,t(0,0,2)],[1,t()]]),
    rightEar:track([[0,t()],[.47,t(0,0,-1.5)],[1,t()]])};
  if(action==="paw-relax") return {
    paw:track([[0,t()],[.22,t(0,0,-3)],[.4,t(0,0,2.2)],[.58,t(0,0,-1.7)],[.78,t(0,0,.7)],[1,t()]]),
    head:track([[0,t()],[.25,t(.1,.45,.8)],[.5,t(.1,.45,.8)],[1,t()]]),
    tail:track([[0,t()],[.55,t(0,0,-2)],[1,t()]]),
    rightEar:track([[0,t()],[.4,t(0,0,2)],[1,t()]])};
  if(action==="listen") return {
    leftEar:track([[0,t()],[.12,t(0,0,-9*d)],[.32,t(0,0,-6*d)],[.7,t(0,0,-3*d)],[1,t()]]),
    rightEar:track([[0,t()],[.18,t(0,0,7*d)],[.34,t(0,0,4*d)],[.73,t(0,0,2*d)],[1,t()]]),
    head:track([[0,t()],[.22,t()],[.4,t(.7*d,-.3,2*d)],[.73,t(.6*d,-.2,1.6*d)],[1,t()]]),
    tail:track([[0,t()],[.3,t(0,0,-2*d)],[.75,t(0,0,-2*d)],[1,t()]]),
  };
  if(action==="balance") return {
    body:track([[0,t()],[.18,t(0,.15,-.2*d)],[.43,t(.2*d,0,.85*d)],[.72,t(.2*d,0,.85*d)],[1,t()]]),
    head:track([[0,t()],[.2,t()],[.47,t(-.25*d,.1,-1*d)],[.75,t(-.25*d,.1,-1*d)],[1,t()]]),
    tail:track([[0,t()],[.28,t(0,0,-2*d)],[.56,t(0,0,-5*d)],[.79,t(0,0,-3*d)],[1,t()]]),
    leftEar:track([[0,t()],[.45,t(0,0,2*d)],[1,t()]]),
  };
  if(action==="check-tail") return {
    tail:track([[0,t()],[.18,t(0,0,-7)],[.4,t(0,0,-4)],[.55,t(0,0,-7)],[.78,t(0,0,-3)],[1,t()]]),
    head:track([[0,t()],[.15,t()],[.35,t(-.8,.8,-2.5)],[.66,t(-.8,.8,-2.5)],[.83,t(-.3,.3,-1)],[1,t()]]),
    body:track([[0,t()],[.38,t(-.1,0,-.4)],[.72,t(-.1,0,-.4)],[1,t()]]),
    leftEar:track([[0,t()],[.3,t(0,0,-5)],[.7,t(0,0,-2)],[1,t()]]),
  };
  if(action==="check-shoes") return {
    head:track([[0,t()],[.16,t(0,-.2,-.4)],[.37,t(.2,1.6,4.2)],[.66,t(.2,1.6,4.2)],[.81,t(-.1,.4,.8)],[1,t()]]),
    body:track([[0,t()],[.32,t(0,.2,.6)],[.7,t(0,.2,.6)],[1,t()]]),
    rightEar:track([[0,t()],[.4,t(0,0,5)],[.72,t(0,0,3)],[1,t()]]),
    lids:blink([[0,0],[.23,0],[.37,.38],[.68,.38],[.85,0],[1,0]]),
  };
  if(action==="sneeze") return {
    head:track([[0,t()],[.2,t(0,-.4,-1.5)],[.36,t(0,-.6,-2)],[.43,t(.2,1.3,4)],[.51,t(-.2,-.25,-1)],[.65,t(.1,.2,.7)],[1,t()]]),
    body:track([[0,t()],[.34,t(0,-.1,-.25)],[.44,t(0,.35,1.2)],[.56,t(0,-.1,-.35)],[.72,t()],[1,t()]]),
    leftEar:track([[0,t()],[.34,t(0,0,-3)],[.45,t(0,0,8)],[.63,t(0,0,-2)],[1,t()]]),
    rightEar:track([[0,t()],[.34,t(0,0,3)],[.45,t(0,0,-7)],[.63,t(0,0,2)],[1,t()]]),
    tail:track([[0,t()],[.42,t()],[.54,t(0,0,6)],[.72,t(0,0,-2)],[1,t()]]),
    lids:blink([[0,0],[.21,.3],[.35,.6],[.41,1],[.54,1],[.66,0],[1,0]]),
  };
  return {
    head:track([[0,t()],[.22,t(0,.3,.4)],[.51,t(.1,1.1,2.2)],[.64,t(.1,1.1,2.2)],[.73,t(0,-.2,-.5)],[1,t()]]),
    body:track([[0,t()],[.45,t(0,.2,.3)],[.7,t(0,.2,.3)],[1,t()]]),
    tail:track([[0,t()],[.5,t(0,0,-3)],[.8,t(0,0,-2)],[1,t()]]),
    leftEar:track([[0,t()],[.5,t(0,0,5)],[.75,t(0,0,2)],[1,t()]]),
    rightEar:track([[0,t()],[.5,t(0,0,-4)],[.75,t(0,0,-2)],[1,t()]]),
    lids:blink([[0,0],[.23,.5],[.45,.85],[.58,1],[.68,.75],[.76,0],[.88,.25],[1,0]]),
  };
}
function chotaRoomObstacles() {
  return [
    {id:"sofa",x0:0,y0:.565,x1:.205,y1:.722},
    {id:"chair",x0:.807,y0:.585,x1:1,y1:.724},
    {id:"console",x0:.535,y0:.535,x1:.827,y1:.573},
    {id:"left-table",x0:0,y0:.723,x1:.167,y1:.904},
    {id:"right-table",x0:.891,y0:.665,x1:1,y1:.805},
    {id:"left-plant",x0:0,y0:.90,x1:.16,y1:1},
    {id:"right-plant",x0:.872,y0:.815,x1:1,y1:1},
  ];
}
function chotaRoomSegmentClear(a, b, obstacles, radius=.023) {
  // Slab intersection sweeps the whole segment; a delayed frame cannot tunnel.
  return obstacles.every(box => {
    let enter=0, leave=1;
    for (const axis of ["x","y"]) {
      const low=box[axis+"0"]-radius, high=box[axis+"1"]+radius, delta=b[axis]-a[axis];
      if (Math.abs(delta)<1e-9) { if (a[axis]<=low || a[axis]>=high) return true; }
      else { const t0=(low-a[axis])/delta,t1=(high-a[axis])/delta; enter=Math.max(enter,Math.min(t0,t1)); leave=Math.min(leave,Math.max(t0,t1)); }
    }
    return enter>=leave || leave<=0 || enter>=1;
  });
}
function chotaRoomRoute(from, to, obstacles=chotaRoomObstacles()) {
  const radius=.023, margin=radius+.001;
  const free=p=>p.x>=.025 && p.x<=.975 && p.y>=.59 && p.y<=.97 && obstacles.every(b=>p.x<=b.x0-radius || p.x>=b.x1+radius || p.y<=b.y0-radius || p.y>=b.y1+radius);
  const nodes=[from,to];
  for (const b of obstacles) for (const x of [b.x0-margin,b.x1+margin]) for (const y of [b.y0-margin,b.y1+margin]) if(free({x,y})) nodes.push({x,y});
  const distance=nodes.map(()=>Infinity),previous=[],visited=new Set();distance[0]=0;
  while(visited.size<nodes.length) {
    let i=-1;for(let j=0;j<nodes.length;j++) if(!visited.has(j)&&(i<0||distance[j]<distance[i])) i=j;
    if(i<0||!Number.isFinite(distance[i])||i===1) break;
    visited.add(i);
    for(let j=0;j<nodes.length;j++) if(!visited.has(j)&&chotaRoomSegmentClear(nodes[i],nodes[j],obstacles,radius)) {
      const d=distance[i]+Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y);
      if(d<distance[j]) {distance[j]=d;previous[j]=i;}
    }
  }
  if(!Number.isFinite(distance[1])) return [{...from}]; // A blocked destination never teleports through an object.
  const route=[];for(let i=1;i!==undefined;i=previous[i]) route.unshift({...nodes[i]});
  let travelled=0;return route.map((point,i)=>{if(i) travelled+=Math.hypot(point.x-route[i-1].x,point.y-route[i-1].y);return {...point,s:from.s+(to.s-from.s)*(distance[1]?travelled/distance[1]:1),z:0};});
}
function chotaRoomRoutePoint(route, progress) {
  const lengths=route.slice(1).map((p,i)=>Math.hypot(p.x-route[i].x,p.y-route[i].y));
  let remaining=lengths.reduce((sum,n)=>sum+n,0)*Math.max(0,Math.min(1,progress));
  for(let i=0;i<lengths.length;i++) {if(remaining<=lengths[i] || i===lengths.length-1) {const p=lengths[i]?remaining/lengths[i]:1,a=route[i],b=route[i+1];return {x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,s:a.s+(b.s-a.s)*p,z:0};}remaining-=lengths[i];}
  return {...route[0]};
}
function chotaRoomSupportPoint(from, to, progress) {
  const t=Math.max(0,Math.min(1,progress));
  // Constant downward acceleration, with a small hop to clear the cushion lip.
  return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,s:from.s+(to.s-from.s)*t,z:(from.z||0)+((to.z||0)-(from.z||0))*t+.07*4*t*(1-t),airborne:t>0&&t<1};
}
function chotaRoomVisitLayout(kind) {
  const width = kind === "sofa" ? .235 : kind === "board" ? .235 : .225;
  return {
    width,
    target:kind === "sofa" ? {x:.125,y:.755,z:.088,s:width/.28} : kind === "board" ? {x:.345,y:.605,z:0,s:width/.28} : {x:.77,y:.605,z:0,s:width/.28},
    approach:{x:.235,y:.755,z:0,s:width/.28},
  };
}
function chotaRoomTransform(point, home, size) {
  return `translate(${(point.x-home.x)*size}px,${(point.y-(point.z||0)-home.y)*size}px) scale(${point.s})`;
}
function createTigretonMotion(pet, reactToPlan, event, date) {
  const character = pet.querySelector(".tigreton-character");
  globalThis.ChotaWardrobe?.mount(character);
  const shadow = pet.querySelector(".tigreton-shadow");
  const sleepMark = pet.querySelector(".tigreton-sleep-mark");
  const spark = pet.querySelector(".tigreton-spark");
  const isBirthday = event?.eventType === "birthday";
  const isToday = date && tigretonDaysUntil(date) === 0;
  const sequences = {
    greet: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [3, 2], [4, 2], [2, 2], [5, 2], [1, 2], [0, 3]],
    walk: [[0, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [0, 3]],
    jump: [[0, 2], [12, 1], [13, 2], [14, 1], [15, 2], [14, 1], [16, 2], [17, 2], [0, 3]],
    rest: [[0, 2], [18, 2], [19, 3], [20, 3], [21, 3], [22, 5], [23, 6], [22, 6], [23, 6], [22, 5], [21, 3], [20, 3], [19, 3], [18, 2], [0, 3]],
  };
  const idleHead = character.querySelector(".chota-idle-head");
  const idleBody = character.querySelector(".chota-idle-body");
  const idleTail = character.querySelector(".chota-idle-tail");
  const idlePaw = character.querySelector(".chota-idle-paw");
  const idleEars = [...character.querySelectorAll(".chota-idle-ear")];
  const eyelids = character.querySelector(".chota-idle-eyelids");
  const sleepChest = character.querySelector(".chota-sleep-chest");
  const sleepHead = character.querySelector(".chota-sleep-head");
  const sleepTail = character.querySelector(".chota-sleep-tail");
  let lastSleepMovement = "head";
  let inView = false, timer = 0, frameTimer = 0, blinkTimer = 0, animations = [], destroyed = false, paused = false, spriteRequest = 0;
  let bedtimeActive = false, bedtimeSwitch = null, wakingActive = false, wakingComplete = null, lastAmbientAction = "", frameRaf = 0;
  const attentionTimes = new Map(), familyTimes = new Map();
  const lifeCatalog=chotaLifeCatalog();
  let lifeAction=null, lastLifeAt=-Infinity;
  let lastRoomMoment = pet.closest(".clubhouse-room, .chota-viewer-room-scene")?.dataset.time || "";
  let lastPersonalAt = performance.now(), lastTouchAt = -Infinity;
  let pendingRoomState = null;
  let roomVisit = null, lastRoomVisitAt = performance.now() - 18000;
  const roomVisitTimes = new Map();
  const motionRoot = pet.querySelector(".chota-character-row") || pet;
  const active = () => !destroyed && !paused && inView && !document.hidden && !tigretonReducedMotion.matches && !isChotaSleeping() && !bedtimeActive && !wakingActive;
  function setFrame(frame) {
    character.classList.remove("is-directional", "is-contextual", "is-room-pose");
    character.style.backgroundPosition = `${(frame % 6) * 20}% ${Math.floor(frame / 6) * (100 / 3)}%`;
    globalThis.ChotaWardrobe?.frame(character,"base",frame);
  }
  function setDirectionalFrame(frame) {
    character.classList.remove("is-idling", "is-speaking", "is-contextual", "is-room-pose");
    character.classList.add("is-directional");
    character.style.backgroundPosition = `${(frame % 5) * 25}% ${Math.floor(frame / 5) * (100 / 3)}%`;
    globalThis.ChotaWardrobe?.frame(character,"directional",frame);
  }
  function stop() {
    const wakeDone = wakingComplete;
    wakingComplete = null;
    wakingActive = false;
    bedtimeActive = false;
    bedtimeSwitch = null;
    spriteRequest++;
    lifeAction=null;
    clearTimeout(timer);
    clearTimeout(frameTimer);
    clearTimeout(blinkTimer);
    if (frameRaf) { if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameRaf); else clearTimeout(frameRaf); frameRaf = 0; }
    animations.forEach(animation => animation.cancel());
    animations = [];
    pet.style.transform = "";
    pet.style.transformOrigin = "";
    motionRoot.style.transform = "";
    motionRoot.style.transformOrigin = "";
    character.style.transform = "";
    shadow.style.opacity = "";
    shadow.style.transform = "";
    const depth=pet.closest(".chota-room-depth");
    if(depth) {delete depth.dataset.sofaDepth;delete depth.dataset.chairDepth;}
    for(const prop of pet.closest(".clubhouse-room, .chota-viewer-room-scene")?.querySelectorAll(".chota-room-prop[data-chota-rest-z]")||[]) prop.style.zIndex=prop.dataset.chotaRestZ;
    roomVisit = null;
    pet.classList.remove("is-visiting-room", "is-sitting-on-sofa");
    pet.closest(".clubhouse-room, .chota-viewer-room-scene")?.classList.remove("is-chota-on-sofa");
    delete pet.dataset.attention;
    pet.closest(".clubhouse-room, .chota-viewer-room-scene")?.classList.remove("is-switch-pressed");
    pet.classList.remove("is-going-to-sleep", "is-falling-asleep", "is-waking-up", "is-walking");
    pet.classList.remove("is-awake", "is-sleeping", "is-sleep-reacting");
    character.classList.remove("is-speaking", "is-idling", "is-sleep-breathing");
    setFrame(0);
    wakeDone?.();
  }
  function animateIdle(target, frames, options) {
    if (!target) return;
    const animation = target.animate(frames, options);
    animations.push(animation);
    animation.onfinish = () => {
      // Filled poses remain cancellable when another action, sleep or visibility wins.
      if (!["forwards", "both"].includes(options.fill)) animations = animations.filter(item => item !== animation);
    };
    return animation;
  }
  function scheduleBlink() {
    clearTimeout(blinkTimer);
    if (!active() || !character.classList.contains("is-idling")) return;
    blinkTimer = setTimeout(() => {
      if (!active() || !character.classList.contains("is-idling")) return;
      const doubleBlink = Math.random() < .22;
      animateIdle(eyelids, doubleBlink ? [{opacity:0},{opacity:1,offset:.16},{opacity:0,offset:.32},{opacity:0,offset:.55},{opacity:1,offset:.72},{opacity:0}] : [{opacity:0}, {opacity:1,offset:.3}, {opacity:1,offset:.55}, {opacity:0}], {duration:doubleBlink ? 370 : 155,easing:"linear"});
      scheduleBlink();
    }, 3800 + Math.random() * 4800);
  }
  function canAttend(key, now, cooldown) {
    return key !== lastAmbientAction && now - (attentionTimes.get(key) ?? -Infinity) >= cooldown && now-(familyTimes.get(chotaAttentionFamily(key))??-Infinity)>=18000;
  }
  function chooseAttention(now) {
    const room = pet.closest(".clubhouse-room, .chota-viewer-room-scene");
    if (!room) return {action:"ears"};
    const moment = room.dataset.time || "";
    if (moment && moment !== lastRoomMoment) {
      lastRoomMoment = moment;
      return {action:"window", target:room.querySelector(".clubhouse-sky")};
    }
    const outdoor=room.querySelector(".club-outdoor-flyer, .club-outdoor-patrol");
    const lifeChoice=now-lastLifeAt>22000 ? chotaChooseLifeAction({now,moment,lastAction:lastAmbientAction,times:attentionTimes,families:familyTimes,lastTouchAt,outdoor:!!outdoor}) : null;
    // A busy agenda/window/vacuum must leave space for his own small gestures.
    // This is a maximum wait, not a forced cycle: eligible families stay random.
    if(lifeChoice && now-lastLifeAt>60000) return {action:lifeChoice,target:lifeChoice==="listen"?outdoor:null};
    const plan = room.querySelector(".clubhouse-plan:not(.clubhouse-plan-empty)");
    // Longer actions have destinations and generous pauses; a visible comment wins.
    if (now - lastRoomVisitAt > 105000 && now - lastTouchAt > 20000 && !room.querySelector('[aria-expanded="true"][data-chota-open]')) {
      const destinations = ["window", "sofa", ...(plan ? ["board"] : [])].filter(kind => now - (roomVisitTimes.get(kind) ?? -Infinity) > (kind === "sofa" ? 420000 : kind === "board" ? 300000 : 270000));
      if (destinations.length && Math.random() < .28) return {action:`visit-${destinations[Math.floor(Math.random() * destinations.length)]}`};
    }
    const days = date instanceof Date && Number.isFinite(date.getTime()) ? tigretonDaysUntil(date) : Infinity;
    if (plan && event?.id !== "clubhouse-idle" && days >= 0 && days <= 2 && canAttend("plan", now, 95000)) {
      return {action:"plan", target:plan};
    }
    const vacuum = room.querySelector(".chota-room-robot-vacuum");
    if (vacuum && canAttend("roomba", now, 48000)) {
      const target = vacuum.getBoundingClientRect(), body = character.getBoundingClientRect();
      const distance = Math.hypot(target.left + target.width / 2 - body.left - body.width / 2, target.top + target.height / 2 - body.top - body.height * .85);
      if (target.width > 0 && distance < room.clientWidth * .42) return {action:"roomba", target:vacuum};
    }
    if (["dawn", "evening"].includes(moment) && canAttend("window", now, 110000)) return {action:"window", target:room.querySelector(".clubhouse-sky")};
    if(lifeChoice && (outdoor || Math.random()<.65)) return {action:lifeChoice,target:lifeChoice==="listen"?outdoor:null};
    if (now - lastPersonalAt > 28000 && now - lastTouchAt > 12000) {
      const choices = ["scratch", "shirt", "stretch"].filter(action => canAttend(action, now, action === "stretch" ? 150000 : 90000));
      if (choices.length) return {action:choices[Math.floor(Math.random() * choices.length)]};
    }
    const choices = ["look", "ears", "tail", "settle"].filter(action => canAttend(action,now,30000));
    return {action:choices[Math.floor(Math.random() * choices.length)] || "quiet"};
  }
  function gazeAt(target, kind) {
    const body = character.getBoundingClientRect(), targetBox = target?.getBoundingClientRect();
    const direction = targetBox ? (targetBox.left + targetBox.width / 2 < body.left + body.width / 2 ? -1 : 1) : (Math.random() < .5 ? -1 : 1);
    const down = kind === "roomba", duration = down ? 3400 : 3900;
    const turn = direction * (down ? 2 : 1.8), vertical = down ? .8 : -.8;
    if (down && target) {
      let samples = 0, previous = null, from = "translate(0,0) rotate(0deg)";
      function followVacuum() {
        if (!active() || !character.classList.contains("is-idling")) return;
        previous?.cancel();
        const box = target.getBoundingClientRect(), body = character.getBoundingClientRect();
        const side = Math.max(-1, Math.min(1, (box.left + box.width / 2 - body.left - body.width / 2) / (body.width * .8)));
        const to = samples >= 4 ? "translate(0,0) rotate(0deg)" : `translate(${side * .8}%,.8%) rotate(${side * 2}deg)`;
        previous = animateIdle(idleHead, [{transform:from},{transform:to}], {duration:650,fill:"forwards",easing:"ease-in-out"});
        from = to;
        if (samples++ < 4) frameTimer = setTimeout(followVacuum, 650);
      }
      followVacuum();
    } else animateIdle(idleHead, [{transform:"translate(0,0) rotate(0deg)"},{transform:`translate(${direction * .8}%,${vertical}%) rotate(${turn}deg)`,offset:.23},{transform:`translate(${direction * .55}%,${vertical}%) rotate(${turn * .7}deg)`,offset:.72},{transform:"translate(0,0) rotate(0deg)"}], {duration,easing:"ease-in-out"});
    idleEars.forEach((ear,index) => animateIdle(ear, [{transform:"rotate(0deg)"},{transform:`rotate(${direction * (index ? 2 : 3)}deg)`,offset:.2},{transform:"rotate(0deg)"}], {duration:1800,delay:index*100,easing:"ease-in-out"}));
    animateIdle(idleTail, [{transform:"rotate(0deg)"},{transform:`rotate(${down ? -3 : 2}deg)`,offset:.5},{transform:"rotate(0deg)"}], {duration:duration+200,easing:"ease-in-out"});
    if (kind === "window") animateIdle(eyelids, [{opacity:0},{opacity:.5,offset:.35},{opacity:.5,offset:.55},{opacity:0}], {duration:2100,delay:700,easing:"ease-in-out"});
  }
  function playPersonal(action) {
    const request = ++spriteRequest;
    void ensureChotaContextSprite().then(ready => {
      if (request !== spriteRequest || !active()) return;
      if (!ready) { schedule(); return; }
      stop();
      pet.classList.add("is-awake");
      pet.dataset.attention = action;
      character.classList.add("is-contextual");
      const row = {plan:0, scratch:1, stretch:2, shirt:3}[action] ?? 0;
      const frames = action === "stretch" ? [[0,180],[1,220],[2,850],[3,650],[2,350],[1,220],[0,180]] : action === "scratch" ? [[0,150],[1,200],[2,300],[3,180],[2,180],[3,180],[2,280],[1,200],[0,180]] : action === "shirt" ? [[0,180],[2,350],[3,220],[2,320],[3,180],[2,250],[0,220]] : [[0,180],[1,200],[2,950],[3,550],[2,700],[1,180],[0,180]];
      const duration = frames.reduce((total, [, hold]) => total + hold, 0);
      animateIdle(character, [{transform:"rotate(0deg) scale(1)"},{transform:`rotate(${action === "scratch" ? .35 : -.2}deg) scale(1,${action === "stretch" ? 1.005 : 1.002})`,offset:.5},{transform:"rotate(0deg) scale(1)"}], {duration,easing:"ease-in-out"});
      let index = 0;
      function advancePersonal() {
        if (!active()) { refresh(); return; }
        if (index >= frames.length) { idle(); return; }
        const [column, hold] = frames[index++];
        character.style.backgroundPosition = `${column * (100 / 3)}% ${row * (100 / 3)}%`;
        globalThis.ChotaWardrobe?.frame(character,"contextual",row*4+column);
        frameTimer = setTimeout(advancePersonal, hold);
      }
      advancePersonal();
    });
  }
  function playLifeAction(action, {elapsed=0,direction=null,target=null}={}) {
    if(!active() || !lifeCatalog[action]) return;
    if(roomVisit) {returnFromRoom(()=>playLifeAction(action));return;}
    const info=lifeCatalog[action];
    if(elapsed>=info.duration) {idle();return;}
    if(direction===null) {
      const box=target?.getBoundingClientRect(),body=target?character.getBoundingClientRect():null;
      direction=box&&body ? (box.left+box.width*.5<body.left+body.width*.5?-1:1) : (Math.random()<.5?-1:1);
    }
    stop();
    const now=performance.now();
    lifeAction={action,direction,started:now-elapsed};
    lastLifeAt=now-elapsed;lastAmbientAction=action;attentionTimes.set(action,now-elapsed);familyTimes.set(info.family,now-elapsed);
    pet.classList.add("is-awake");character.classList.add("is-idling");pet.dataset.attention=action;
    const targets={head:idleHead,body:idleBody,tail:idleTail,paw:idlePaw,leftEar:idleEars[0],rightEar:idleEars[1],lids:eyelids};
    for(const [key,frames] of Object.entries(chotaLifeTracks(action,direction))) {
      const animation=animateIdle(targets[key],frames,{duration:info.duration,fill:"both",easing:"linear"});
      if(animation && elapsed) animation.currentTime=elapsed;
    }
    frameTimer=setTimeout(()=>{if(active() && lifeAction?.action===action) idle();},info.duration-elapsed);
  }
  function performAttention(choice) {
    const {action,target} = choice, now = performance.now();
    if(action==="quiet") {schedule();return;}
    if(lifeCatalog[action]) {playLifeAction(action,{target});return;}
    familyTimes.set(chotaAttentionFamily(action),now);
    attentionTimes.set(action, now); lastAmbientAction = action;
    pet.dataset.attention = action;
    if (action.startsWith("visit-")) { visitRoom(action.slice(6)); return; }
    if (["plan","scratch","stretch","shirt"].includes(action)) {
      lastPersonalAt = now; playPersonal(action); return;
    }
    if (action === "roomba" || action === "window" || action === "look") gazeAt(target, action);
    else if (action === "ears") idleEars.forEach((ear,index) => animateIdle(ear, [{transform:"rotate(0deg)"},{transform:`rotate(${index ? 3 : -4}deg)`,offset:.2},{transform:`rotate(${index ? -2 : 2}deg)`,offset:.42},{transform:"rotate(0deg)",offset:.65},{transform:`rotate(${index ? 1 : -2}deg)`,offset:.8},{transform:"rotate(0deg)"}], {duration:1150,delay:index*140,easing:"ease-in-out"}));
    else if (action === "tail") animateIdle(idleTail, [{transform:"rotate(0deg)"},{transform:"rotate(-5deg)",offset:.22},{transform:"rotate(4deg)",offset:.5},{transform:"rotate(-2deg)",offset:.76},{transform:"rotate(0deg)"}], {duration:2900,easing:"ease-in-out"});
    else {
      animateIdle(idleBody, [{transform:"scale(1) rotate(0deg)"},{transform:"scale(1.006,1.004) rotate(.5deg)",offset:.38},{transform:"scale(1) rotate(0deg)"}], {duration:2400,easing:"ease-in-out"});
      animateIdle(idleHead, [{transform:"rotate(0deg)"},{transform:"rotate(-.8deg)",offset:.38},{transform:"rotate(0deg)"}], {duration:2400,easing:"ease-in-out"});
    }
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (!active() || !character.classList.contains("is-idling")) return;
    timer = setTimeout(() => {
      if (active() && character.classList.contains("is-idling")) performAttention(chooseAttention(performance.now()));
    }, 7000 + Math.random() * 6500);
  }
  function roomPose(frame) {
    character.classList.remove("is-directional", "is-idling", "is-speaking", "is-contextual");
    character.classList.add("is-room-pose");
    character.style.backgroundPosition = `${frame * (100 / 3)}% 0`;
    globalThis.ChotaWardrobe?.frame(character,"room",frame);
    character.style.transform = "";
  }
  function roomGeometry(room, size) {
    const bounds=room.getBoundingClientRect(), obstacles=chotaRoomObstacles(), props=[];
    for(const node of room.querySelectorAll(".chota-room-prop")) {
      if(node.classList.contains("chota-room-prop--decoration") && !node.classList.contains("chota-room-remote")) continue;
      const box=node.getBoundingClientRect();
      if(node.classList.contains("chota-room-remote") && (box.top-bounds.top)/size<.55) continue;
      if(!box.width) continue;
      const x=(box.left+box.width*.5-bounds.left)/size,y=(box.top+box.height*.9-bounds.top)/size;
      if(node.dataset.chotaRestZ===undefined) node.dataset.chotaRestZ=node.style.zIndex;
      props.push({node,y});
      if(node.classList.contains("chota-room-robot-vacuum")) obstacles.push({id:"vacuum-lane",x0:.315,y0:.84,x1:.56,y1:.925});
      else obstacles.push({id:"prop",x0:x-box.width/size*.38,y0:y-.014,x1:x+box.width/size*.38,y1:y+.014});
    }
    return {obstacles,props};
  }
  function roomDepth(point, room, props=[]) {
    // Only furniture in front of the actor cuts its silhouette. Seated actors
    // retain the back cushion behind them and the front arm in front of them.
    const seated=pet.classList.contains("is-sitting-on-sofa"), depth=pet.closest(".chota-room-depth");
    const sofa=seated?"seat":point.y<.745?"back":"front";
    if(depth) {if(depth.dataset.sofaDepth!==sofa) depth.dataset.sofaDepth=sofa;const chair=point.y<.748?"back":"front";if(depth.dataset.chairDepth!==chair) depth.dataset.chairDepth=chair;}
    for(const prop of props) prop.node.style.zIndex=prop.y>point.y?"4":"2";
  }
  function roomPosition(point) {
    if (!roomVisit) return;
    roomVisit.position = {...point};
    roomDepth(point, roomVisit.room, roomVisit.geometry?.props);
    const {home} = roomVisit;
    const size=roomVisit.size;
    motionRoot.style.transform = chotaRoomTransform(point, home, size);
    const height=point.z||0;
    shadow.style.transform=`translateY(${height*size/point.s}px) scaleX(${Math.max(.55,1-height*3)})`;
    shadow.style.opacity=pet.classList.contains("is-sitting-on-sofa")&&!point.airborne?"0":String(Math.max(.25,.6-height*2));
  }
  function roomWalk(from, to, progress, elapsed, away) {
    const visit=roomVisit;
    const key=[from.x,from.y,to.x,to.y].join(":");
    if(!visit.routes[key]) visit.routes[key]=chotaRoomRoute(from,to,visit.geometry.obstacles);
    const point=chotaRoomRoutePoint(visit.routes[key],progress),previous=visit.position;
    roomPosition(point);
    const mirror = away ? point.x>previous.x : point.x<previous.x;
    setDirectionalFrame((away ? 0 : 8) + Math.floor(elapsed / 125) % 8);
    if(Math.abs(point.x-previous.x)>.00001) character.style.transform=mirror?"scaleX(-1)":"";
  }
  function returnFromRoom(afterReturn) {
    if (!roomVisit) { afterReturn?.(); return; }
    roomVisit.afterReturn = afterReturn;
    if (roomVisit.returning) return;
    roomVisit.returning = {
      from:{...roomVisit.position}, started:performance.now(),
      rise:(roomVisit.position.z||0)>0 ? 650 : 0,
      duration:Math.min(3700, Math.max(1600, Math.hypot(roomVisit.position.x-roomVisit.home.x, roomVisit.position.y-roomVisit.home.y) * 10000)),
    };
  }
  function visitRoom(kind) {
    const request = ++spriteRequest;
    void Promise.all([ensureChotaDirectionalSprite(), kind === "sofa" ? ensureChotaRoomSprite() : true]).then(ready => {
      if (request !== spriteRequest || !active()) return;
      if (!ready.every(Boolean)) { lastRoomVisitAt = performance.now(); schedule(); return; }
      const room = pet.closest(".clubhouse-room, .chota-viewer-room-scene");
      const roomBox = room?.getBoundingClientRect(), spriteBox = pet.querySelector(".tigreton-sprite")?.getBoundingClientRect();
      if (!roomBox?.width || !spriteBox?.width) { schedule(); return; }
      stop();
      lastRoomVisitAt = performance.now(); roomVisitTimes.set(kind, lastRoomVisitAt);
      const feetX = spriteBox.left + spriteBox.width * .5, feetY = spriteBox.top + spriteBox.width * .945;
      const home = {x:(feetX-roomBox.left)/roomBox.width, y:(feetY-roomBox.top)/roomBox.width, s:1};
      const layout = chotaRoomVisitLayout(kind);
      const scale = layout.width * roomBox.width / spriteBox.width;
      const target = {...layout.target,s:scale}, approach = {...layout.approach,s:scale};
      const geometry=roomGeometry(room,roomBox.width);
      if(chotaRoomRoute(home,kind==="sofa"?approach:target,geometry.obstacles).length<2) {schedule();return;}
      roomVisit = {kind, home, target, approach, position:home, size:roomBox.width, started:performance.now(), room, geometry, routes:{}, returning:null, afterReturn:null};
      motionRoot.style.transformOrigin = "50% 94.5%";
      pet.classList.add("is-awake", "is-visiting-room", "is-walking");
      pet.dataset.attention = `visit-${kind}`;
      advanceRoomVisit();
    });
  }
  function advanceRoomVisit() {
    frameRaf = 0;
    if (!roomVisit || !active()) { refresh(); return; }
    const visit = roomVisit, elapsed = performance.now() - visit.started;
    const {home,target,approach,kind,room} = visit;
    function seated(value) {
      pet.classList.toggle("is-sitting-on-sofa", value);
      room.classList.toggle("is-chota-on-sofa", value);
      shadow.style.opacity = value ? "0" : ".6";
    }
    function done() { const callback = visit.afterReturn; idle(); callback?.(); }
    if (visit.returning) {
      const back = visit.returning, t = performance.now() - back.started;
      if (t >= back.duration + back.rise) { done(); return; }
      if (t < back.rise) { seated(true); roomPosition(chotaRoomSupportPoint(back.from,approach,t/back.rise)); roomPose(3); }
      else {
        seated(false);
        roomWalk(back.rise ? approach : back.from,home,(t-back.rise)/back.duration,t,false);
      }
    } else if (kind === "window" || kind === "board") {
      const travel = kind === "board" ? 4300 : 5600;
      const pause = kind === "board" ? 4500 : 5800;
      if (elapsed < travel) roomWalk(home,target,elapsed/travel,elapsed,true);
      else if (elapsed < travel + pause) {
        roomPosition(target);
        if (kind === "board") {
          // A real plan gives him something to read; he points once before returning.
          setDirectionalFrame(elapsed > travel + 2400 && elapsed < travel + 3300 ? 17 : 16);
          character.style.transform = "";
        } else {
          setDirectionalFrame(elapsed > 9700 && elapsed < 10500 ? 19 : 16);
          character.style.transform = "scaleX(-1)";
          // A quiet look through the glass, then a glance back into the room.
          if (elapsed < 9700) character.style.transform += ` rotate(${Math.sin((elapsed-5600)/1800)*.7}deg)`;
        }
      } else if (elapsed < travel * 2 + pause) roomWalk(target,home,(elapsed-travel-pause)/travel,elapsed-travel-pause,false);
      else { done(); return; }
    } else {
      if (elapsed < 4900) roomWalk(home,approach,elapsed/4900,elapsed,true);
      else if (elapsed < 6100) {
        if (elapsed < 5350) { roomPosition(approach); setDirectionalFrame(19); character.style.transform = ""; }
        else { seated(true); roomPosition(chotaRoomSupportPoint(approach,target,(elapsed-5350)/750)); roomPose(0); }
      } else if (elapsed < 13500) {
        seated(true); roomPosition(target); roomPose(elapsed > 8000 && elapsed < 11700 ? 2 : 1);
      } else if (elapsed < 14500) { seated(true); roomPosition(chotaRoomSupportPoint(target,approach,(elapsed-13500)/1000)); roomPose(elapsed < 14200 ? 3 : 0); }
      else if (elapsed < 15700) {
        seated(false); roomPosition(approach); setDirectionalFrame(19); character.style.transform = "";
      } else if (elapsed < 20600) roomWalk(approach,home,(elapsed-15700)/4900,elapsed-15700,false);
      else { done(); return; }
    }
    // Pixel-art gait changes at 8 fps; the path itself stays smooth at display speed.
    frameRaf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(advanceRoomVisit) : setTimeout(advanceRoomVisit, 16);
  }
  function noticeUser() {
    if (!active() || performance.now() - lastTouchAt < 3000) return;
    lastTouchAt = performance.now(); attentionTimes.set("user", lastTouchAt);
    if (roomVisit) { returnFromRoom(() => play("greet")); return; }
    play("greet");
  }
  function idle() {
    stop();
    if (!active()) return;
    pet.classList.add("is-awake");
    character.classList.add("is-idling");
    // The torso expands only a fraction; the shoes and contact shadow never slide.
    const breath = 4400 + Math.random() * 1000;
    animateIdle(idleBody, [{transform:"scale(1)"}, {transform:"scale(1.004,1.007)",offset:.48}, {transform:"scale(1)"}], {duration:breath,iterations:Infinity,easing:"ease-in-out"});
    animateIdle(idleHead, [{transform:"translateY(0)"}, {transform:"translateY(-.3%)",offset:.48}, {transform:"translateY(0)"}], {duration:breath,iterations:Infinity,easing:"ease-in-out"});
    scheduleBlink();
    schedule();
  }
  function play(gesture) {
    if (!active()) return;
    if (roomVisit) { returnFromRoom(() => play(gesture)); return; }
    if (lifeCatalog[gesture]) {playLifeAction(gesture);return;}
    if (gesture === "walk" || gesture === "shuffle") { playDirectionalWalk(); return; }
    if (!chotaSpritesReady.poses) {
      const request = ++spriteRequest;
      void ensureChotaSprites().then(() => { if (request === spriteRequest && active() && chotaSpritesReady.poses) play(gesture); });
      return;
    }
    stop();
    pet.classList.add("is-awake");
    const action = {look: "greet", nod: "greet", shuffle: "walk", celebrate: "jump", doze: "rest"}[gesture] || gesture;
    const frames = sequences[action] || sequences.greet;
    const duration = frames.reduce((total, [, ticks]) => total + ticks, 0) * (1000 / 12);
    if (action === "walk") {
      animations.push(character.animate([{transform: "translateX(-5%)"}, {transform: "translateX(6%)", offset: .5}, {transform: "translateX(0)"}], {duration, easing: "ease-in-out"}));
      animations.push(shadow.animate([{transform: "translateX(-5%)"}, {transform: "translateX(6%)", offset: .5}, {transform: "translateX(0)"}], {duration}));
    } else if (action === "jump") {
      animations.push(shadow.animate([{transform: "scaleX(1)", opacity: .6}, {transform: "scaleX(.65)", opacity: .3, offset: .48}, {transform: "scaleX(1)", opacity: .6}], {duration}));
      animations.push(spark.animate([{opacity: 0, transform: "scale(.6)"}, {opacity: 1, offset: .45}, {opacity: 0, transform: "scale(1.1)"}], {duration}));
    } else if (action === "rest") {
      animations.push(sleepMark.animate([{opacity: 0}, {opacity: .85, offset: .4}, {opacity: .85, offset: .72}, {opacity: 0}], {duration}));
    }
    let index = 0;
    function advance() {
      if (!active()) return;
      if (index >= frames.length) { idle(); return; }
      const [frame, ticks] = frames[index++];
      setFrame(frame);
      frameTimer = setTimeout(advance, ticks * (1000 / 12));
    }
    advance();
  }
  function playDirectionalWalk() {
    visitRoom("board");
  }
  function speak(text, gesture) {
    if (bedtimeActive || wakingActive) return;
    if (roomVisit) { returnFromRoom(() => speak(text, gesture)); return; }
    stop();
    if (!active() || !String(text || "").trim()) return;
    if (!chotaSpritesReady.talk) {
      const request = ++spriteRequest;
      void ensureChotaSprites().then(() => { if (request === spriteRequest && active() && chotaSpritesReady.talk) speak(text, gesture); });
      return;
    }
    pet.classList.add("is-awake");
    character.classList.add("is-speaking");
    const words = String(text).trim().split(/\s+/);
    const duration = Math.min(3600, Math.max(1400, words.length * 175));
    const started = performance.now();
    const mouths = [0, 1, 2, 1, 0, 2, 1];
    let beat = 0;
    function advanceSpeech() {
      if (!active()) { stop(); return; }
      const elapsed = performance.now() - started;
      if (elapsed >= duration) {
        stop();
        if (gesture) play(gesture); else idle();
        return;
      }
      const word = words[Math.min(words.length - 1, Math.floor(elapsed / duration * words.length))];
      const punctuation = /[.,;:!?]$/.test(word) && beat % 3 === 2;
      const mouth = punctuation ? 0 : mouths[beat++ % mouths.length];
      character.style.backgroundPosition = `${mouth * 50}% 0`;
      globalThis.ChotaWardrobe?.frame(character,"talk",mouth);
      frameTimer = setTimeout(advanceSpeech, punctuation ? 220 : 95 + (beat % 3) * 25);
    }
    advanceSpeech();
  }
  function scheduleSleepMovement() {
    clearTimeout(timer);
    if (destroyed || paused || !inView || document.hidden || tigretonReducedMotion.matches || !isChotaSleeping() || !character.classList.contains("is-sleep-breathing")) return;
    timer = setTimeout(() => {
      if (destroyed || paused || !inView || document.hidden || tigretonReducedMotion.matches || !isChotaSleeping() || !character.classList.contains("is-sleep-breathing")) return;
      lastSleepMovement = lastSleepMovement === "head" ? "tail" : "head";
      if (lastSleepMovement === "tail") {
        animateIdle(sleepTail, [
          {transform:"rotate(0deg)",offset:0},
          {transform:"rotate(-5deg)",offset:.3},
          {transform:"rotate(1.8deg)",offset:.52},
          {transform:"rotate(-1.5deg)",offset:.7},
          {transform:"rotate(0deg)",offset:1}
        ], {duration:1700,easing:"ease-in-out"});
      } else {
        animateIdle(sleepHead, [
          {transform:"translateY(0) rotate(0deg)",offset:0},
          {transform:"translateY(.35%) rotate(-1.3deg)",offset:.32},
          {transform:"translateY(.35%) rotate(-1.3deg)",offset:.52},
          {transform:"translateY(0) rotate(.25deg)",offset:.82},
          {transform:"translateY(0) rotate(0deg)",offset:1}
        ], {duration:2600,easing:"ease-in-out"});
      }
      scheduleSleepMovement();
    }, 7000 + Math.random() * 8500);
  }
  function captureRoomState() {
    if (pendingRoomState) return pendingRoomState;
    const now=performance.now(),ages=map=>[...map].map(([key,at])=>[key,now-at]);
    const ambient={lastAction:lastAmbientAction,times:ages(attentionTimes),families:ages(familyTimes),lifeAge:now-lastLifeAt,personalAge:now-lastPersonalAt,visitAge:now-lastRoomVisitAt,visits:ages(roomVisitTimes)};
    if (!roomVisit) return {kind:"ambient",ambient,life:lifeAction?{action:lifeAction.action,direction:lifeAction.direction,elapsed:now-lifeAction.started}:null};
    const {kind,home,target,approach,position,started,returning} = roomVisit;
    return {kind,ambient,home:{...home},target:{...target},approach:{...approach},position:{...position},elapsed:Math.max(0,now-started),returning:returning ? {from:{...returning.from},elapsed:Math.max(0,now-returning.started),rise:returning.rise,duration:returning.duration} : null};
  }
  function restoreRoomState(state) {
    const now=performance.now();
    if(state.ambient) {
      const history=state.ambient,restore=(map,values)=>{map.clear();for(const [key,age] of values||[]) map.set(key,now-age);};
      lastAmbientAction=history.lastAction||"";restore(attentionTimes,history.times);restore(familyTimes,history.families);restore(roomVisitTimes,history.visits);
      lastLifeAt=now-history.lifeAge;lastPersonalAt=now-history.personalAge;lastRoomVisitAt=now-history.visitAge;
    }
    if(state.kind==="ambient") {
      if(state.life && lifeCatalog[state.life.action]) playLifeAction(state.life.action,state.life); else idle();
      return true;
    }
    const room = pet.closest(".clubhouse-room, .chota-viewer-room-scene");
    const box = room?.getBoundingClientRect(), sprite = pet.querySelector(".tigreton-sprite")?.getBoundingClientRect();
    if (!box?.width || !sprite?.width) return false;
    roomVisit = {...state,room,size:box.width,geometry:roomGeometry(room,box.width),routes:{},started:now-state.elapsed,returning:state.returning ? {...state.returning,started:now-state.returning.elapsed} : null,afterReturn:null};
    motionRoot.style.transformOrigin = "50% 94.5%";
    pet.classList.add("is-awake","is-visiting-room","is-walking");
    pet.dataset.attention = `visit-${state.kind}`;
    lastRoomVisitAt = now; roomVisitTimes.set(state.kind,now);
    advanceRoomVisit();
    return true;
  }
  function refresh() {
    const validTransition = (bedtimeActive && isChotaSleeping()) || (wakingActive && !isChotaSleeping());
    if (validTransition && !destroyed && !paused && inView && !document.hidden && !tigretonReducedMotion.matches) return;
    // Agenda/light refreshes must not restart an inhale or pile up sleeping animations.
    if (character.classList.contains("is-sleep-breathing") && !destroyed && !paused && inView && !document.hidden && !tigretonReducedMotion.matches && isChotaSleeping()) return;
    if (bedtimeActive && bedtimeSwitch) bedtimeSwitch();
    stop();
    if (!destroyed && isChotaSleeping()) {
      // Hold the fully reclined frame, including with reduced motion enabled.
      pet.classList.add("is-sleeping");
      setFrame(22);
      if (!paused && inView && !document.hidden && !tigretonReducedMotion.matches) {
        character.classList.add("is-sleep-breathing");
        // The shirt rises with the chest; the face, folded paws and shoes stay supported.
        // Five source pixels at the shoulder remain visible at the room's small display size.
        animateIdle(sleepChest, [
          {transform:"scaleY(1)",offset:0},
          {transform:"scaleY(1.12)",offset:.42},
          {transform:"scaleY(1.12)",offset:.5},
          {transform:"scaleY(1)",offset:.92},
          {transform:"scaleY(1)",offset:1}
        ], {duration:4400,iterations:Infinity,easing:"ease-in-out"});
        scheduleSleepMovement();
      }
      return;
    }
    if (active()) {
      const state = pendingRoomState;
      pendingRoomState = null;
      if (!state || !restoreRoomState(state)) idle();
    }
  }
  function bedtime(switchLights) {
    if (destroyed || paused || !inView || document.hidden || tigretonReducedMotion.matches || !isChotaSleeping()) return false;
    const departure=roomVisit ? {position:{...roomVisit.position},approach:{...roomVisit.approach},home:{...roomVisit.home},size:roomVisit.size} : null;
    stop();
    if(departure) {motionRoot.style.transformOrigin="50% 94.5%";motionRoot.style.transform=chotaRoomTransform(departure.position,departure.home,departure.size);}
    bedtimeActive = true;
    bedtimeSwitch = switchLights;
    pet.classList.add("is-going-to-sleep");
    pet.classList.add("is-awake");
    void ensureChotaDirectionalSprite().then(ready => {
      if (!bedtimeActive || destroyed) return;
      if (!ready) { bedtimeSwitch?.(); bedtimeActive = false; refresh(); return; }
      startBedtime();
    });
    return true;
    function startBedtime() {
    motionRoot.style.transform="";
    const room = pet.closest(".clubhouse-room, .chota-viewer-room-scene");
    const switchBox = room?.querySelector(".clubhouse-light-switch")?.getBoundingClientRect();
    const petBox = pet.getBoundingClientRect(), spriteBox = pet.querySelector(".tigreton-sprite").getBoundingClientRect();
    const bounds=room?.getBoundingClientRect();
    if(!bounds?.width) {bedtimeSwitch?.();bedtimeActive=false;refresh();return;}
    const home={x:(spriteBox.left+spriteBox.width*.5-bounds.left)/bounds.width,y:(spriteBox.top+spriteBox.width*.945-bounds.top)/bounds.width,s:1,z:0};
    const width=.235, scale=width*bounds.width/spriteBox.width;
    // Directional press cell 18: map its fingertip to the actual wall rocker.
    const destination={x:switchBox?(switchBox.left+switchBox.width*.5-bounds.left)/bounds.width+(.5-30/256)*width:.408,
      y:switchBox?(switchBox.top+switchBox.height*.5-bounds.top)/bounds.width+(.945-80/256)*width:.648,s:scale,z:0};
    const geometry=roomGeometry(room,bounds.width),dismount=departure?.position.z>0?650:0;
    const floorStart=departure?(dismount?departure.approach:departure.position):home;
    const outbound=chotaRoomRoute(floorStart,destination,geometry.obstacles),inbound=chotaRoomRoute(home,destination,geometry.obstacles);
    motionRoot.style.transformOrigin="50% 94.5%";
    animateIdle(sleepMark, [{opacity:0}, {opacity:.2,offset:.35}, {opacity:.85}], {duration:3600,delay:14550,fill:"forwards",easing:"ease-in-out"});
    const started = performance.now();
    let switched = false, lastPose = -1;
    function advanceBedtime() {
      if (!bedtimeActive || destroyed) return;
      const raw=performance.now()-started;
      if(raw<dismount) {
        const point=chotaRoomSupportPoint(departure.position,departure.approach,raw/dismount);
        pet.classList.add("is-sitting-on-sofa");room?.classList.add("is-chota-on-sofa");
        motionRoot.style.transform=chotaRoomTransform(point,home,room.clientWidth||bounds.width);
        roomDepth(point,room,geometry.props);roomPose(3);shadow.style.opacity="0";
        frameTimer=setTimeout(advanceBedtime,95);return;
      }
      pet.classList.remove("is-sitting-on-sofa");room?.classList.remove("is-chota-on-sofa");shadow.style.opacity=".6";
      const elapsed = raw-dismount;
      if (elapsed >= 5950 && !switched) {
        switched = true;
        room?.classList.add("is-switch-pressed");
        bedtimeSwitch?.();
        bedtimeSwitch = null;
      }
      if (elapsed >= 18150) { bedtimeActive = false; refresh(); return; }
      const progress=elapsed<5200?Math.max(0,(elapsed-200)/5000):elapsed<6950?1:elapsed<11950?1-(elapsed-6950)/5000:0;
      const point=chotaRoomRoutePoint(elapsed<6950?outbound:inbound,progress);
      motionRoot.style.transform=chotaRoomTransform(point,home,room.clientWidth||bounds.width);
      roomDepth(point,room,geometry.props);
      if (elapsed < 200) setDirectionalFrame(16);
      else if (elapsed < 5200) setDirectionalFrame(Math.floor((elapsed - 200) / 125) % 8);
      else if (elapsed < 5500) setDirectionalFrame(16);
      else if (elapsed < 5850) setDirectionalFrame(17);
      else if (elapsed < 6150) setDirectionalFrame(18);
      else if (elapsed < 6400) setDirectionalFrame(17);
      else if (elapsed < 6650) setDirectionalFrame(16);
      else if (elapsed < 6950) setDirectionalFrame(19);
      else if (elapsed < 11950) setDirectionalFrame(8 + Math.floor((elapsed - 6950) / 125) % 8);
      else if (elapsed < 12150) setDirectionalFrame(19);
      else if (elapsed < 12350) setFrame(0);
      else {
        pet.classList.add("is-falling-asleep");
        // Give every real pose time to read: crouch, sit, lean on an elbow,
        // then close the eyes and settle into a slower sleeping breath.
        const pose = elapsed < 12900 ? 18 : elapsed < 13800 ? 19 : elapsed < 14950 ? 20 : elapsed < 16600 ? 21 : 22;
        setFrame(pose);
        if (pose !== lastPose) {
          lastPose = pose;
          animateIdle(character, [{transform:"translateY(-.4%) rotate(.3deg)"}, {transform:"translateY(0) rotate(0deg)"}], {duration:700,easing:"ease-out"});
        }
      }
      frameTimer = setTimeout(advanceBedtime, 95);
    }
    advanceBedtime();
    }
  }
  function wakeup(onComplete) {
    if (destroyed || paused || !inView || document.hidden || tigretonReducedMotion.matches || isChotaSleeping()) return false;
    stop();
    wakingActive = true;
    wakingComplete = onComplete;
    pet.classList.add("is-waking-up");
    // A reluctant wake-up: stir, prop up, doze off once more, sit and slowly stand.
    const poses = [[22,1000],[23,300],[22,650],[21,1350],[22,650],[21,1700],[20,1500],[19,1000],[18,800],[0,650]];
    const duration = poses.reduce((total, [, hold]) => total + hold, 0);
    const started = performance.now();
    let lastPose = -1;
    animateIdle(sleepMark, [{opacity:.85}, {opacity:.35,offset:.35}, {opacity:0}], {duration:3300,fill:"forwards",easing:"ease-in-out"});
    function advanceWakeup() {
      if (!wakingActive || destroyed) return;
      const elapsed = performance.now() - started;
      if (elapsed >= duration) { wakingActive = false; refresh(); return; }
      let boundary = 0;
      const [pose, hold] = poses.find(([, hold]) => (boundary += hold) > elapsed);
      setFrame(pose);
      if (pose !== lastPose) {
        lastPose = pose;
        animateIdle(character, [
          {transform:"translateY(0) rotate(0deg)"},
          {transform:`translateY(.25%) rotate(${pose === 21 ? -.8 : .45}deg)`,offset:.5},
          {transform:"translateY(0) rotate(0deg)"}
        ], {duration:Math.min(hold,1300),easing:"ease-in-out"});
      }
      frameTimer = setTimeout(advanceWakeup, Math.min(100, boundary - elapsed));
    }
    advanceWakeup();
    return true;
  }
  function reactSleeping() {
    if (destroyed || paused || !inView || document.hidden || !isChotaSleeping() || bedtimeActive || tigretonReducedMotion.matches || pet.classList.contains("is-sleep-reacting")) return;
    stop();
    pet.classList.add("is-sleeping");
    setFrame(22);
    pet.classList.add("is-sleep-reacting");
    animations.push(character.animate([
      {transform:"translateY(0) rotate(0deg)"},
      {transform:"translateY(-.7%) rotate(-.7deg)",offset:.28},
      {transform:"translateY(.3%) rotate(.35deg)",offset:.58},
      {transform:"translateY(0) rotate(0deg)"}
    ], {duration:760,easing:"ease-in-out"}));
    // Both poses keep the eyes shut; their ear/head shift is a brief sleepy stir.
    const frames = [[22,80],[23,150],[22,90],[23,110],[22,330]];
    let index = 0;
    function advanceSleepStir() {
      if (destroyed || paused || !inView || document.hidden || !isChotaSleeping()) { refresh(); return; }
      if (index >= frames.length) { refresh(); return; }
      const [frame, duration] = frames[index++];
      setFrame(frame);
      frameTimer = setTimeout(advanceSleepStir, duration);
    }
    advanceSleepStir();
  }
  const scene=pet.closest(".clubhouse-room, .chota-viewer-room-scene");
  const resizeObserver=typeof ResizeObserver==="function" && scene ? new ResizeObserver(entries=>{
    if(roomVisit && entries[0].contentRect.width) roomVisit.size=entries[0].contentRect.width;
  }) : null;
  resizeObserver?.observe(scene);
  const observer = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    if (inView) { void ensureChotaDirectionalSprite(); void ensureChotaContextSprite(); }
    refresh();
    // Entering the screen or receiving a new plan must not trigger a commanded action.
  }, {threshold: .25});
  observer.observe(pet);
  refresh();
  document.addEventListener("visibilitychange", refresh);
  tigretonReducedMotion.addEventListener("change", refresh);
  return {
    play,
    testBase:setFrame,testDirectional:setDirectionalFrame,testRoom:roomPose,testPersonal:playPersonal,
    speak,
    reactSleeping,
    noticeUser,
    bedtime,
    wakeup,
    isWaking: () => wakingActive,
    refresh,
    stopSpeaking: refresh,
    captureRoomState,
    pause() { paused = true; refresh(); },
    resume(state = null) { pendingRoomState = state; paused = false; refresh(); },
    react: () => play(isBirthday && isToday ? "jump" : "greet"),
    destroy() { if (bedtimeActive) bedtimeSwitch?.(); destroyed = true; stop(); observer.disconnect(); resizeObserver?.disconnect(); document.removeEventListener("visibilitychange", refresh); tigretonReducedMotion.removeEventListener("change", refresh); },
  };
}
function tigretonSpriteMarkup(interactive = false) {
  const tag = interactive ? "button" : "span";
  return `<${tag} class="tigreton-sprite" ${interactive ? 'type="button" data-chota-open aria-label="Mostrar comentario de El Chota sobre el próximo plan" aria-expanded="false" aria-keyshortcuts="Shift+Enter"' : 'role="img" aria-label="El Chota"'}><span class="tigreton-character" aria-hidden="true"><span class="chota-idle-tail"></span><span class="chota-idle-body"><span class="chota-idle-paw"></span></span><span class="chota-idle-feet"></span><span class="chota-idle-head"><span class="chota-idle-ear chota-idle-ear--left"></span><span class="chota-idle-ear chota-idle-ear--right"></span><svg class="chota-idle-eyelids" viewBox="0 0 256 256" aria-hidden="true"><path fill="#fa7906" d="M117 84Q126 81 136 93L141 99 138 105Q126 108 119 99Z M164 98Q174 94 182 100L184 105 180 113Q172 116 164 108Z"/><path fill="none" stroke="#27170f" stroke-width="1.7" stroke-linecap="round" d="M119 96q11 10 20 3m26 5q8 7 17 1"/></svg></span><span class="chota-sleep-base"></span><span class="chota-sleep-tail"></span><span class="chota-sleep-chest"></span><span class="chota-sleep-head"></span><span class="chota-sleep-foreground"></span></span><i class="tigreton-shadow" aria-hidden="true"></i><span class="tigreton-sleep-mark" aria-hidden="true">z</span><span class="tigreton-spark" aria-hidden="true">✦</span></${tag}>`;
}