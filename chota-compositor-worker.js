/* One complete five-sheet outfit per change, off the UI thread. Preview models
   use their own worker, so trying clothes cannot cancel the equipped outfit. */
'use strict';
const dimensions={base:[6,4],directional:[5,4],contextual:[4,4],room:[4,1],talk:[3,1]};let latestSequence=0;
self.onmessage=async({data})=>{
  const{sequence,anatomy,bare,foreground,layers}=data||{};latestSequence=sequence;
  try{
    if(!Number.isSafeInteger(sequence)||!anatomy||!bare||!foreground||!Array.isArray(layers))throw new Error('Invalid outfit composition.');
    const slots=new Set(layers.map(layer=>layer.slot)),results=[];
    for(const[sheet,[cols,rows]]of Object.entries(dimensions)){
      const canvas=new OffscreenCanvas(cols*256,rows*256),ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable.');ctx.imageSmoothingEnabled=false;
      const draw=async(url,allow128=false)=>{
        if(sequence!==latestSequence)return false;
        const response=await fetch(url,{credentials:'same-origin'});if(!response.ok)throw new Error(`Missing ${sheet} outfit image: ${url}`);
        const bitmap=await createImageBitmap(await response.blob());
        try{if(sequence!==latestSequence)return false;const full=bitmap.width===canvas.width&&bitmap.height===canvas.height,half=allow128&&bitmap.width===cols*128&&bitmap.height===rows*128;if(!full&&!half)throw new Error(`Atlas grid mismatch: ${url}`);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);return true;}finally{bitmap.close();}
      };
      // Bare parts exist only for unoccupied slots. Anatomy contains no baked
      // clothes, and all original garments follow the exact same layer contract.
      for(const slot of ['bottomwear','footwear','topwear'])if(!slots.has(slot))if(!await draw(bare[slot][sheet]))return;
      if(!await draw(anatomy[sheet]))return;
      for(const slot of ['bottomwear','footwear','topwear','outerwear'])for(const layer of layers.filter(layer=>layer.slot===slot))if(!await draw(layer.atlases[sheet],true))return;
      if(layers.some(layer=>layer.slot==='outerwear'||layer.type==='atlas'))if(!await draw(foreground[sheet]))return;
      results.push({sheet,blob:await canvas.convertToBlob({type:'image/png'})});if(sequence!==latestSequence)return;
    }
    if(sequence===latestSequence)self.postMessage({sequence,results});
  }catch(error){if(sequence===latestSequence)self.postMessage({sequence,error:error.message||'Outfit composition failed.'});}
};
