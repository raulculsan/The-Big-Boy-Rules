from PIL import Image, ImageDraw
from pathlib import Path
from io import BytesIO
import zipfile, xml.etree.ElementTree as ET

art = Path(__file__).parent
root = art.parents[2]
source = Image.open(art / 'seated-source.png').convert('RGBA')
reference = Image.open(root / 'artwork/chota/directional-v1/standing-reference.png').convert('RGBA')
logo = reference.crop((121, 123, 166, 154))
pixels = logo.load()
for y in range(logo.height):
    for x in range(logo.width):
        r,g,b,a = pixels[x,y]
        pixels[x,y] = (r,g,b,a if max(r,g,b) < 100 else 0)
frames=[]
cell=source.width//2
for i in range(4):
    sprite=source.crop(((i%2)*cell,(i//2)*cell,(i%2+1)*cell,(i//2+1)*cell))
    alpha=sprite.getchannel('A').point(lambda value: value if value > 48 else 0)
    sprite.putalpha(alpha)
    sprite=sprite.crop(alpha.getbbox())
    # Constant head scale; seated hips lower while the soles share a floor line.
    height=[202,202,202,196][i]
    sprite=sprite.resize((round(sprite.width*height/sprite.height),height),Image.Resampling.LANCZOS)
    frame=Image.new('RGBA',(256,256))
    frame.alpha_composite(sprite,((256-sprite.width)//2,242-height))
    # Preserve the approved shirt mark; seated cloth remains readable at app size.
    mark=logo.resize((29,20),Image.Resampling.NEAREST)
    frame.alpha_composite(mark,[(115,145),(124,142),(118,143),(124,155)][i])
    frame=frame.resize((128,128),Image.Resampling.LANCZOS).resize((256,256),Image.Resampling.NEAREST)
    frame.save(art/f'seat-{i}.png')
    frames.append(frame)
sheet=Image.new('RGBA',(1024,256))
for i,frame in enumerate(frames): sheet.alpha_composite(frame,(i*256,0))
sheet.save(root/'icons/mascot/chota-v2/chota-room-life-v1.webp',lossless=True,method=6)
sheet.save(art/'chota-room-life-v1.png')
contact=Image.new('RGB',(1024,286),'#1b222b')
d=ImageDraw.Draw(contact)
for i,frame in enumerate(frames):
    contact.paste(frame,(i*256,0),frame)
    d.line((i*256,242,(i+1)*256,242),fill='#72927c')
    d.text((i*256+8,264),['BAJAR','SENTADO','RELAJADO','LEVANTARSE'][i],fill='white')
contact.save(art/'contact-sheet.png')
image=ET.Element('image',w='256',h='256',name='El Chota · sentarse en el sofá')
stack=ET.SubElement(image,'stack')
with zipfile.ZipFile(art/'chota-room-life-v1.ora','w') as z:
    z.writestr('mimetype','image/openraster')
    for i,frame in reversed(list(enumerate(frames))):
        data=BytesIO();frame.save(data,format='PNG');path=f'data/frame-{i}.png';z.writestr(path,data.getvalue())
        ET.SubElement(stack,'layer',{'name':['Bajar','Sentarse','Descansar','Levantarse'][i],'src':path,'opacity':'1.0','visibility':'visible' if i==1 else 'hidden','composite-op':'svg:src-over','x':'0','y':'0'})
    z.writestr('stack.xml',ET.tostring(image));data=BytesIO();frames[1].save(data,format='PNG');z.writestr('mergedimage.png',data.getvalue())
print(art/'contact-sheet.png')
