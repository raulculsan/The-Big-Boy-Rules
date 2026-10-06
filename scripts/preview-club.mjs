// Local-only visual fixture. No Supabase, real credentials, or persistent writes.
// This script and its fixtures are deliberately excluded from the native build.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const root = new URL('../',import.meta.url);
const fixture = `
// Hoisted fixture-only auth: independent of any previous local preview session.
function getStoredSession() { return {userId:1}; }
function passwordChangeIsRequired() { return false; }
members.forEach(member => { member.authId = 'fixture-' + member.id; member.password = 'preview-only'; });
rebuildMemberIndexes();
achievements = [
 {id:'fixture-bronze',name:'Primer paso',description:'El comienzo de tu historia en el club.',tier:'bronze',icon:''},
 {id:'fixture-gold',name:'Siempre en el equipo',description:'Por estar ahí cuando hace falta. Un reconocimiento a quienes hacen del grupo un lugar mejor, dentro y fuera del chat.',tier:'gold',icon:''},
 {id:'fixture-silver',name:'El primer encuentro',description:'Un buen comienzo merece ser recordado.',tier:'silver',icon:''},
 {id:'fixture-platinum',name:'Leyenda del club',description:'Un reconocimiento extraordinario.',tier:'platinum',icon:''}
];
achievementAwards = [
 {achievementId:'fixture-bronze',userId:'fixture-1'},
 {achievementId:'fixture-gold',userId:'fixture-1'}, {achievementId:'fixture-gold',userId:'fixture-2'},
 {achievementId:'fixture-gold',userId:'fixture-3'}, {achievementId:'fixture-silver',userId:'fixture-1'},
 {achievementId:'fixture-platinum',userId:'fixture-1'}
];
achievementsLoaded = true;
achievementProgressStatus = 'ready';
achievementProgressUserId = 'fixture-1';
achievements.push({id:'fixture-progress',name:'La voz del club',description:'Cada conversación empieza por alguien.',tier:'silver',icon:'',rule:{metric:'group_messages',target:20}});
achievementProgress = [{achievementId:'fixture-progress',value:7}];
groupEvents = [1,3,8].map((days,index) => {
 const date = new Date(); date.setDate(date.getDate()+days); date.setHours(20,0,0,0);
 return {id:'fixture-event-'+index,eventType:'event',title:['Cena del club','Partido de la semana','Un plan por decidir'][index],location:['Nuestro sitio de siempre','Pista central',''][index],startsAt:date.toISOString(),description:'Evento de prueba para revisar la agenda.'};
});
messages = [{id:'fixture-message',member:1,text:'¿Nos vemos el viernes?',createdAt:new Date().toISOString()}];
currentAuthUser = {id:'fixture-1'};
if (new URLSearchParams(location.search).has('keyboard-qa')) {
  // Local-only send result: never contact the real database from a visual test.
  sendPrivateMessage = async body => {
    await new Promise(resolve => setTimeout(resolve, 250));
    return {id:'fixture-send-'+Date.now(),senderId:'fixture-1',recipientId:'fixture-2',body,createdAt:new Date().toISOString()};
  };
}
privateMessages = Array.from({length:18}, (_,index) => ({
 id:'fixture-private-'+index, senderId:index%2 ? 'fixture-1' : 'fixture-2',
 recipientId:index%2 ? 'fixture-2' : 'fixture-1',
 body:index===17 ? 'Perfecto, nos vemos allí.' : ['¿Organizamos algo para el fin de semana?', 'Claro, ¿te viene bien el sábado?', 'Sí, lo vemos luego en el grupo.'][index%3],
 createdAt:new Date(Date.now()-(18-index)*60000).toISOString()
}));
const fixtureLabel = document.createElement('span');
fixtureLabel.textContent='VISTA LOCAL · DATOS DE PRUEBA';
fixtureLabel.style.cssText='position:fixed;top:0;left:0;z-index:5000;font:8px sans-serif;color:#999;pointer-events:none';
document.body.appendChild(fixtureLabel);
if (currentUser) { refreshProfileSurfaces(); renderCalendar(); renderPrivateContacts(); }
`;
const allow = new Set(['index.html','styles.css','club.css','club-model.js','chat.css','chat-motion.js','chat-keyboard.js','vendor/capacitor.js','app.js','manifest.webmanifest']);
allow.add('tab-navigation.js');
allow.add('trophy-motion.js');
allow.add('trophy-unlock.js');
allow.add('daily-packs.js');
allow.add('card-collection.js');
allow.add('collection-motion.js');
allow.add('docs/cartas/animaciones/pack-opening-creator.json');
allow.add('packs.css');
allow.add('achievement-admin.js');
allow.add('achievement-progress.js');
allow.add('achievement-admin.css');
allow.add('vendor/lottie-light.min.js');
createServer(async(req,res) => {
  const path = new URL(req.url,'http://localhost').pathname.slice(1) || 'index.html';
  if ((!allow.has(path) && !/^vendor\/fonts\/[\w.-]+$/.test(path) && !/^icons\/[\w.-]+$/.test(path) && !/^icons\/cards\/[\w.-]+\.(png|json)$/.test(path) && !/^icons\/trophies\/(bronze|silver|gold|platinum)\.(svg|json)$/.test(path)) || path.includes('..')) { res.writeHead(404).end(); return; }
  try {
    let body = await readFile(new URL(path,root));
    if (path === 'index.html') body = body.toString().replace(/<script src="(?:vendor\/supabase|config)\.js[^>]+><\/script>/g,'').replace(/<script>\s*if \("serviceWorker"[\s\S]*?<\/script>/,'');
    if (path === 'app.js') body = body.toString() + fixture + await readFile(new URL('scripts/chat-motion-fixture.js',root),'utf8') + await readFile(new URL('scripts/navigation-fixture.js',root),'utf8') + await readFile(new URL('scripts/achievement-admin-fixture.js',root),'utf8');
    const ext = path.split('.').pop();
    if(path==='docs/cartas/animaciones/pack-opening-creator.json')res.setHeader('Access-Control-Allow-Origin','*');
    res.writeHead(200,{'Content-Type':({html:'text/html',js:'text/javascript',css:'text/css',woff2:'font/woff2',svg:'image/svg+xml',png:'image/png'})[ext] || 'application/json','Cache-Control':'no-store'});
    res.end(body);
  } catch { res.writeHead(404).end(); }
}).listen(Number(process.env.BB_PREVIEW_PORT || 5174),'127.0.0.1',()=>console.log('Visual fixture ready · offline local login only'));
