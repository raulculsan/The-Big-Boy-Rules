/* Local QA only: production renderers, fake inventory, no service credentials. */
(() => {
  const status=document.getElementById('qaStatus'),pet=document.getElementById('qaPet');
  pet.innerHTML=tigretonSpriteMarkup(false);const motion=createTigretonMotion(pet,false,null,null);motion.refresh();
  const make=(slot,id,key,name)=>({id,name,item_kind:'clothing',slot,owned:true,active:true,price:0,description:'Artículo de prueba local.',rig_version:slot==='outerwear'?'chota-overlay-v1':'chota-'+slot+'-overlay-v1',garment:{type:'builtin',key}});
  const items=[make('topwear','chota-original-stussy-v1','original-stussy-v1','Camiseta Stüssy original'),make('bottomwear','chota-original-jeans-v1','original-jeans-v1','Vaqueros originales'),make('footwear','chota-original-jordan-chicago-v1','original-jordan-chicago-v1','Jordan Chicago originales'),make('outerwear','chota-tnf-negro-v1','tnf-negro-v1','Plumífero negro'),make('topwear','chota-shirt-supreme-negra-v1','supreme-negra-v1','Camiseta Supreme negra'),make('bottomwear','chota-carhartt-marron-v1','carhartt-marron-v1','Carhartt marrón')];
  let state={wardrobe_version:1,balance:1000,items,outerwear:null,topwear:items[0].id,bottomwear:items[1].id,footwear:items[2].id},requestVersion=0;
  ChotaShop.initialize({cacheNamespace:'modular-local-qa',session:()=> 'qa-user',rpc:async(name,args)=>{
    if(name==='equip_chota_clothing')state={...state,[args.target_slot]:args.target_item_id};
    if(name==='equip_chota_outerwear')state={...state,outerwear:args.target_item_id};
    return{data:structuredClone(state)};
  }});
  ChotaGames.initialize({session:()=> 'qa-user',getOwnedItems:async()=>['football','skateboard','robot-vacuum','darts'],startGame:async()=> 'qa-round',submitScore:async()=>({reward_status:'already_claimed'}),leaderboard:async()=>[]});
  const snapshots={defaults:{outerwear:null,topwear:items[0].id,bottomwear:items[1].id,footwear:items[2].id},bought:{outerwear:items[3].id,topwear:items[4].id,bottomwear:items[5].id,footwear:items[2].id},'no-shirt':{outerwear:null,topwear:null,bottomwear:items[1].id,footwear:items[2].id},bare:{outerwear:null,topwear:null,bottomwear:null,footwear:null}};
  async function look(key){
    const version=++requestVersion;state={...state,...snapshots[key]};status.textContent='Preparando '+key+'…';
    try{
      await ChotaShop.refresh(true);
      await ChotaWardrobe.applyOutfit(Object.fromEntries(['bottomwear','footwear','topwear','outerwear'].map(slot=>[slot,items.find(item=>item.id===state[slot])||null])));
      if(version!==requestVersion)return;
      status.textContent=`${key}: ${ChotaAppearance.enabled()?'base neutral aprobada activa':'sin activar'}\n${ChotaWardrobe.outfit().map(layer=>layer.slot).join(' → ')||'Sin prendas'}\nCambiar ropa también funciona con el diálogo abierto (controles interiores o Alt+1…4).`;
    }catch(error){if(version===requestVersion)status.textContent='SIN ACTIVAR: '+error.message+' No se ha sustituido el cuerpo de producción.';}
  }
  document.addEventListener('click',event=>{const button=event.target.closest('[data-look]');if(button)void look(button.dataset.look);});
  document.addEventListener('keydown',event=>{if(event.altKey&&['1','2','3','4'].includes(event.key)){event.preventDefault();void look(Object.keys(snapshots)[Number(event.key)-1]);}});
  function controls(dialog){if(!dialog||dialog.querySelector('.qa-dialog-looks'))return;const bar=document.createElement('div');bar.className='qa-tools qa-dialog-looks';bar.innerHTML='<button data-look="defaults">Originales</button><button data-look="bought">Compradas</button><button data-look="no-shirt">Sin camiseta</button><button data-look="bare">Sin ropa</button>';dialog.prepend(bar);}
  document.getElementById('qaDilemma').onclick=async()=>{await ChotaDecision.open();controls(document.querySelector('#chotaDecisionDialog')||document.querySelector('dialog[open]'));};
  for(const[id,game]of [['qaSkate','skateboard'],['qaFootball','football'],['qaDarts','darts']])document.getElementById(id).onclick=async()=>{await ChotaGames.openGame(game);controls([...document.querySelectorAll('dialog[open]')].at(-1));};
  document.getElementById('qaInventory').onclick=()=>{ChotaShop.openInventory();controls([...document.querySelectorAll('dialog[open]')].at(-1));};
  document.getElementById('qaStore').onclick=()=>{document.getElementById('bannerShopDialog').showModal();controls(document.getElementById('bannerShopDialog'));void ChotaShop.refresh(true);};
  for(const button of document.querySelectorAll('[data-pose]'))button.onclick=()=>{globalThis.qaSleep=button.dataset.pose==='22';motion.refresh();if(!globalThis.qaSleep&&button.dataset.pose!=='0')motion.testBase(Number(button.dataset.pose));};
  document.getElementById('qaSpeak').onclick=()=>{globalThis.qaSleep=false;motion.refresh();motion.speak('Probando la ropa mientras hablo.');};
  globalThis.addEventListener('pagehide',()=>motion.destroy(),{once:true});
  globalThis.ModularAppearanceQA=Object.freeze({look,state:()=>structuredClone(state),motion});
  void look('defaults');
})();
