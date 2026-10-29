from PIL import Image,ImageDraw
from pathlib import Path
from io import BytesIO
import zipfile,xml.etree.ElementTree as ET

root=Path(__file__).resolve().parents[3];art=Path(__file__).parent
out=root/'icons/mascot/chota-v2'
sheet=Image.open(out/'chota-poses.webp').convert('RGBA')
poses=[sheet.crop(((i%6)*256,(i//6)*256,(i%6+1)*256,(i//6+1)*256)) for i in range(24)]
bases=[Image.open(art/f'base-{i}.png').convert('RGBA') for i in range(4)]
frames=[]
for row in range(4):
    entry=poses[1 if row==0 else 2 if row in (1,2) else 0]
    target=bases[row]
    variation=target.copy()
    frames.extend([poses[0],entry,target,variation])
frames=[f.resize((128,128),Image.Resampling.LANCZOS).resize((256,256),Image.Resampling.NEAREST) for f in frames]
result=Image.new('RGBA',(1024,1024));contact=Image.new('RGB',(1024,1120),'#1b222b');d=ImageDraw.Draw(contact)
names=['TABLON · PENSAR','OREJA','ESTIRARSE','CAMISETA']
for i,f in enumerate(frames):
    x=(i%4)*256;y=(i//4)*256;result.alpha_composite(f,(x,y));cy=(i//4)*280;contact.paste(f,(x,cy),f);d.text((x+8,cy+259),f'{i:02d} {names[i//4]}',fill='white')
result.save(out/'chota-contextual-v1.webp',lossless=True,method=6);result.save(art/'chota-contextual-v1.png');contact.save(art/'contact-sheet.png')
image=ET.Element('image',w='256',h='256',name='El Chota · gestos contextuales');stack=ET.SubElement(image,'stack')
with zipfile.ZipFile(art/'chota-contextual-v1.ora','w') as z:
    z.writestr('mimetype','image/openraster')
    for i,f in reversed(list(enumerate(frames))):
        data=BytesIO();f.save(data,format='PNG');path=f'data/frame-{i:02d}.png';z.writestr(path,data.getvalue());ET.SubElement(stack,'layer',{'name':f'{i:02d} {names[i//4]}','src':path,'opacity':'1.0','visibility':'visible' if i==0 else 'hidden','composite-op':'svg:src-over','x':'0','y':'0'})
    z.writestr('stack.xml',ET.tostring(image));data=BytesIO();frames[0].save(data,format='PNG');z.writestr('mergedimage.png',data.getvalue())
print(art/'contact-sheet.png')
