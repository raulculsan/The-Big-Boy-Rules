// Appended only by the local fixture server; never copied into the application.
async function writeAchievement(method, payload) {
  if (!new URLSearchParams(location.search).has('achievement-qa')) return {error:{message:'Vista local de solo lectura.'}};
  await new Promise(resolve=>setTimeout(resolve,150));
  if (payload.new_name === 'Prueba de error') return {error:{message:'Error de prueba: el borrador debe conservarse.'}};
  let id=payload.target_achievement_id;
  if (method==='create_achievement_with_awards' || method==='create_automatic_achievement') {
    id='fixture-created-'+Date.now();
    achievements.unshift({id,name:payload.new_name,description:payload.new_description,tier:payload.new_tier,icon:'',rule:method==='create_automatic_achievement'?{metric:payload.new_metric,target:payload.new_target}:undefined});
  } else achievementAwards=achievementAwards.filter(award=>String(award.achievementId)!==String(id));
  achievementAwards.push(...(payload.target_user_ids || []).map(userId=>({achievementId:id,userId})));
  return {data:id,error:null};
}
async function loadAchievements() {
  renderAdminAchievements();
  if (activeProfileId && document.getElementById('perfil').classList.contains('active')) renderProfile(activeProfileId,false);
  renderAchievementDetail();
}
if (new URLSearchParams(location.search).has('achievement-qa')) {
  const qaButton=document.createElement('button');
  qaButton.textContent='Simular actualización de miembros';
  qaButton.style.cssText='position:fixed;right:5px;bottom:4px;z-index:9000;font:9px sans-serif;padding:5px;color:#aaa;background:#14171c;border:1px solid #333';
  qaButton.onclick=()=>{members[1]={...members[1],name:members[1].name.endsWith(' QA')?members[1].name.slice(0,-3):members[1].name+' QA'};rebuildMemberIndexes();renderAdminAchievements();};
  document.body.appendChild(qaButton);
}
