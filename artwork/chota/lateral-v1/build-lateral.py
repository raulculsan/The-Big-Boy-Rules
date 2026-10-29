from PIL import Image, ImageDraw, ImageEnhance, ImageOps
from pathlib import Path
from io import BytesIO
import math, zipfile, xml.etree.ElementTree as ET, shutil
root=Path(__file__).resolve().parents[3]
out=root/'icons/mascot/chota-v2'
source=Path('/Users/raulculsan/.codex/generated_images/01a188cb-acba-7803-987c-80c446f73a79/exec-be9a348e-c367-43a9-ae17-27f80b9cd16d.png')
shutil.copy2(source,Path(__file__).parent/'profile-reference.png')
im=Image.open(source).convert('RGBA')
def source_cell(index):
 x=index%4;y=index//4
 cell=im.crop((round(x*im.width/4)+5,round(y*im.height/2)+5,round((x+1)*im.width/4)-5,round((y+1)*im.height/2)-5))
 return cell.resize((256,256),Image.Resampling.LANCZOS)
base=source_cell(0)
def masked(poly):
 mask=Image.new('L',(256,256));ImageDraw.Draw(mask).polygon(poly,fill=255)
 layer=base.copy();layer.putalpha(Image.composite(base.getchannel('A'),Image.new('L',(256,256)),mask));return layer
core=masked([(0,0),(256,0),(256,115),(145,115),(146,137),(143,164),(90,168),(78,144),(84,121),(0,121)])
# Each limb stays separate, so the gait changes at hips and shoulders, not by shearing the character.
tail=masked([(166,130),(229,122),(229,195),(159,195),(159,175),(170,160)])
near_arm=masked([(137,119),(153,125),(176,154),(179,177),(159,181),(140,165),(130,140)])
far_arm=masked([(39,127),(75,128),(98,119),(105,135),(84,153),(38,162)])
shoe=masked([(33,216),(65,211),(90,216),(112,227),(115,246),(33,249)])
shoe=shoe.crop((30,208,118,251))
# Anchor of the ankle inside the preserved shoe cutout.
shoe_anchor=(62,20)
def rotate_layer(layer,angle,pivot):return layer.rotate(angle,resample=Image.Resampling.BICUBIC,center=pivot)
def leg(layer,hip,ankle,lift,far=False,angle=0):
 d=ImageDraw.Draw(layer)
 hx,hy=hip;ax,ay=ankle
 knee=((hx+ax)/2-(8 if lift else 0), (hy+ay)/2- (5 if lift else 0))
 kx,ky=knee
 dark='#172b44' if far else '#23486f';mid='#2f5279' if far else '#3c6c9d';light='#3c6087' if far else '#5282b0'
 poly=[(hx-17,hy-3),(hx+17,hy-2),(kx+16,ky),(ax+14,ay-3),(ax+13,ay+5),(ax-17,ay+5),(kx-17,ky+3)]
 d.polygon(poly,fill=mid,outline='#131d2a',width=3)
 d.polygon([(hx+8,hy+2),(kx+10,ky),(ax+10,ay-1),(ax+3,ay),(kx+2,ky-1)],fill=dark)
 d.line([(hx-8,hy+3),(kx-8,ky),(ax-9,ay-1)],fill=light,width=3)
 d.line([(kx-10,ky+4),(kx+3,ky+6)],fill=dark,width=2)
 s=shoe.copy()
 if far:
  a=s.getchannel('A');s=ImageEnhance.Brightness(s).enhance(.77);s.putalpha(a)
 canvas=Image.new('RGBA',(256,256));canvas.alpha_composite(s,(round(ax-shoe_anchor[0]),round(ay-shoe_anchor[1])))
 canvas=rotate_layer(canvas,angle,(ax,ay));layer.alpha_composite(canvas)
# Planted ankle advances steadily through stance. Lift occurs only during swing.
gait=[(96,229,False,0),(109,229,False,0),(126,229,False,0),(146,228,False,-11),(151,215,True,-19),(132,207,True,7),(109,213,True,11),(95,223,True,4)]
frames=[]
for i in range(8):
 f=Image.new('RGBA',(256,256));bob=[0,1,0,-1,0,1,0,-1][i]
 f.alpha_composite(rotate_layer(tail,[-2,-1,1,3,2,0,-2,-3][i],(171,173)))
 f.alpha_composite(rotate_layer(far_arm,[-8,0,10,18,20,8,-3,-10][i],(96,130)))
 ax,ay,lift,ang=gait[(i+4)%8];leg(f,(137,164+bob),(ax,ay),lift,True,ang)
 ax,ay,lift,ang=gait[i];leg(f,(122,165+bob),(ax,ay),lift,False,ang)
 f.alpha_composite(core,(0,bob))
 f.alpha_composite(rotate_layer(near_arm,[13,5,-6,-17,-23,-9,1,10][i],(142,127)),(0,bob))
 frames.append(f)
# Neutral side pose, then actual reach/press art from the profile reference.
f=Image.new('RGBA',(256,256));f.alpha_composite(tail);f.alpha_composite(far_arm)
leg(f,(137,164),(139,229),False,True);leg(f,(122,165),(119,229),False)
f.alpha_composite(core);f.alpha_composite(rotate_layer(near_arm,-5,(142,127)));frames.append(f)
for idx in [6,7]:
 p=source_cell(idx);bbox=p.getbbox();p=p.crop(bbox);scale=234/p.height;p=p.resize((round(p.width*scale),234),Image.Resampling.LANCZOS)
 f=Image.new('RGBA',(256,256));f.alpha_composite(p,(round(128-p.width/2),244-p.height));frames.append(f)
frames.append(frames[8].copy())
# One shared pixel scale and shoe baseline across the rigged cycle.
frames=[f.resize((128,128),Image.Resampling.LANCZOS).resize((256,256),Image.Resampling.NEAREST) for f in frames]
sheet=Image.new('RGBA',(1536,512))
for i,f in enumerate(frames):sheet.alpha_composite(f,((i%6)*256,(i//6)*256))
sheet.save(out/'chota-lateral-v1.png');sheet.save(out/'chota-lateral-v1.webp',lossless=True,method=6)
# Editable frame layers for Krita, kept outside packaged icons.
ora=Path(__file__).parent/'chota-lateral-v1.ora'
image=ET.Element('image',w='256',h='256',name='El Chota · perfil lateral');stack=ET.SubElement(image,'stack')
with zipfile.ZipFile(ora,'w') as z:
 z.writestr('mimetype','image/openraster')
 for i,f in reversed(list(enumerate(frames))):
  data=BytesIO();f.save(data,format='PNG');path=f'data/frame-{i:02d}.png';z.writestr(path,data.getvalue());ET.SubElement(stack,'layer',{'name':f'{i:02d} '+('Paso lateral' if i<8 else 'Reposo de perfil' if i in (8,11) else 'Alcanzar interruptor' if i==9 else 'Pulsar interruptor'),'src':path,'opacity':'1.0','visibility':'visible' if i==0 else 'hidden','composite-op':'svg:src-over','x':'0','y':'0'})
 z.writestr('stack.xml',ET.tostring(image));data=BytesIO();frames[0].save(data,format='PNG');z.writestr('mergedimage.png',data.getvalue())
sheet.resize((1152,384),Image.Resampling.NEAREST).save(Path(__file__).parent/'contact-sheet.png')
print(out/'chota-lateral-v1.webp');print(ora)
