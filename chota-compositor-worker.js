/* The atlas is rebuilt only when clothes change, off the UI thread. No per-frame work. */
'use strict';
const dimensions={base:[6,4],directional:[5,4],contextual:[4,4],room:[4,1],talk:[3,1]};
let latestSequence=0;
self.onmessage=async({data})=>{
  const {sequence,base,layers}=data||{};
  latestSequence=sequence;
  try{
    if(!Number.isSafeInteger(sequence)||!base||!Array.isArray(layers))throw new Error('Invalid outfit composition.');
    const results=[];
    for(const[sheet,[cols,rows]]of Object.entries(dimensions)){
      const canvas=new OffscreenCanvas(cols*256,rows*256),ctx=canvas.getContext('2d');
      if(!ctx)throw new Error('Canvas unavailable.');
      ctx.imageSmoothingEnabled=false;
      for(const url of [base[sheet],...layers.map(layer=>layer.atlases[sheet])]){
        if(sequence!==latestSequence)return;
        const response=await fetch(url,{credentials:'same-origin'});if(!response.ok)throw new Error('Missing outfit image.');
        if(sequence!==latestSequence)return;
        const bitmap=await createImageBitmap(await response.blob());
        try{if(sequence!==latestSequence)return;if(bitmap.width!==canvas.width||bitmap.height!==canvas.height)throw new Error('Atlas grid mismatch.');ctx.drawImage(bitmap,0,0);}finally{bitmap.close();}
      }
      results.push({sheet,blob:await canvas.convertToBlob({type:'image/png'})});if(sequence!==latestSequence)return;
    }
    if(sequence===latestSequence)self.postMessage({sequence,results});
  }catch(error){self.postMessage({sequence,error:error.message||'Outfit composition failed.'});}
};
