from PIL import Image,ImageDraw
from pathlib import Path
from io import BytesIO
import zipfile,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[3];out=root/'icons/mascot/chota-v2'
base=Image.open(out/'chota-poses.webp').convert('RGBA').crop((0,0,256,256))
polys={
 'tail':[(37,137),(79,136),(92,166),(100,185),(84,197),(49,181),(37,159)],
 'ear-left':[(82,26),(119,22),(133,51),(120,67),(91,66),(81,49)],
 'ear-right':[(178,39),(210,42),(215,72),(195,88),(179,72)]
}
core=base.copy();layers={}
for name,poly in polys.items():
 mask=Image.new('L',(256,256));ImageDraw.Draw(mask).polygon(poly,fill=255)
 part=base.copy();part.putalpha(Image.composite(base.getchannel('A'),Image.new('L',(256,256)),mask));layers[name]=part
 alpha=core.getchannel('A');alpha.paste(0,(0,0),mask);core.putalpha(alpha)
for name,im in {'core':core,**layers}.items(): im.save(out/f'chota-idle-{name}-v1.webp',lossless=True,method=6)
ora=Path(__file__).parent/'chota-idle-layers.ora';image=ET.Element('image',w='256',h='256',name='El Chota · capas ambientales');stack=ET.SubElement(image,'stack')
with zipfile.ZipFile(ora,'w') as z:
 z.writestr('mimetype','image/openraster')
 for i,(name,im) in enumerate(reversed(list({'core':core,**layers}.items()))):
  data=BytesIO();im.save(data,format='PNG');path=f'data/layer-{i}.png';z.writestr(path,data.getvalue());ET.SubElement(stack,'layer',{'name':name,'src':path,'opacity':'1.0','visibility':'visible','composite-op':'svg:src-over','x':'0','y':'0'})
 z.writestr('stack.xml',ET.tostring(image));data=BytesIO();base.save(data,format='PNG');z.writestr('mergedimage.png',data.getvalue())
