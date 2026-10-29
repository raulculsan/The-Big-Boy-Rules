from PIL import Image,ImageDraw,ImageEnhance
from pathlib import Path
from io import BytesIO
import math,zipfile,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[3];art=Path(__file__).parent;out=root/'icons/mascot/chota-v2'
back=Image.open(art/'base-0.png').convert('RGBA');front=Image.open(art/'base-1.png').convert('RGBA')
# Restore the approved chest mark from the original standing pose.
original=Image.open(art/'standing-reference.png').convert('RGBA');logo=original.crop((121,123,166,154));px=logo.load()
for y in range(logo.height):
 for x in range(logo.width):
  r,g,b,a=px[x,y];px[x,y]=(r,g,b,a if max(r,g,b)<100 else 0)
front.alpha_composite(logo.resize((36,25),Image.Resampling.NEAREST),(125,126))

def piece(base,poly):
 m=Image.new('L',(256,256));ImageDraw.Draw(m).polygon(poly,fill=255);p=base.copy();p.putalpha(Image.composite(base.getchannel('A'),Image.new('L',(256,256)),m));return p,m

def make_parts(base,view):
 if view=='back':
  tailpoly=[(137,132),(217,126),(218,194),(133,194)]
  nearpoly=[(91,126),(108,135),(101,158),(100,181),(87,190),(74,177),(78,149)]
  farpoly=[(148,128),(163,139),(167,177),(155,185),(146,166)]
  legpolys=[[(91,164),(130,167),(130,247),(63,247),(66,222),(85,208),(88,185)],[(128,168),(163,165),(170,247),(128,247)]]
  shoes=[(66,215,129,246),(128,215,168,246)];anchors=[(44,7),(17,7)]
  hips=[(112,173),(145,173)];ankles=[(110,222),(145,222)]
 else:
  tailpoly=[(38,127),(111,127),(111,192),(38,192)]
  nearpoly=[(98,134),(116,143),(112,167),(112,185),(101,192),(90,181),(93,158)]
  farpoly=[(159,138),(176,150),(178,181),(167,192),(157,176)]
  legpolys=[[(101,168),(134,173),(134,247),(80,247),(83,210),(95,195),(97,181)],[(133,174),(165,167),(192,247),(133,247)]]
  shoes=[(83,214,134,246),(132,214,192,246)];anchors=[(29,9),(18,9)]
  hips=[(114,175),(146,175)];ankles=[(112,223),(150,223)]
 tail,tm=piece(base,tailpoly);near,nm=piece(base,nearpoly);far,fm=piece(base,farpoly)
 remove=Image.new('L',(256,256));d=ImageDraw.Draw(remove)
 for poly in legpolys+[tailpoly,nearpoly,farpoly]:d.polygon(poly,fill=255)
 core=base.copy();core.putalpha(Image.composite(Image.new('L',(256,256)),base.getchannel('A'),remove))
 shoeimgs=[]
 for rect in shoes:shoeimgs.append(base.crop(rect))
 legs=[]
 for poly in legpolys:
  layer,mask=piece(base,poly)
  for blocker in [tm,nm,fm]:
   from PIL import ImageChops
   mask=ImageChops.subtract(mask,blocker)
  layer.putalpha(Image.composite(base.getchannel('A'),Image.new('L',(256,256)),mask));legs.append(layer)
 return dict(core=core,tail=tail,near=near,far=far,legs=legs,shoes=shoeimgs,anchors=anchors,hips=hips,ankles=ankles)

def rot(im,a,p):return im.rotate(a,Image.Resampling.BICUBIC,center=p)

def leg(canvas,hip,ankle,kneebend,shoe,shoe_anchor,far,angle):
 hx,hy=hip;ax,ay=ankle;kx=(hx+ax)/2+kneebend;ky=(hy+ay)/2-abs(kneebend)*.25
 d=ImageDraw.Draw(canvas);mid='#38638e' if far else '#4776a6';dark='#263f64';light='#608bb5'
 # Jeans follow the hip-knee-ankle chain; no rearward pelvis or long rear leg.
 poly=[(hx-15,hy-4),(hx+15,hy-4),(kx+14,ky),(ax+13,ay-1),(ax+12,ay+5),(ax-13,ay+5),(kx-15,ky+2)]
 d.polygon(poly,fill=mid,outline='#192d46',width=2)
 d.polygon([(hx+8,hy),(kx+9,ky),(ax+9,ay+3),(ax+2,ay+3),(kx+2,ky)],fill=dark)
 d.line([(hx-8,hy+4),(kx-8,ky),(ax-7,ay+1)],fill=light,width=2)
 d.line([(kx-10,ky+4),(kx+4,ky+5)],fill=dark,width=2)
 lay=Image.new('RGBA',(256,256));lay.alpha_composite(shoe,(round(ax-shoe_anchor[0]),round(ay-shoe_anchor[1])));canvas.alpha_composite(rot(lay,angle,(ax,ay)))

def walk(base,view):
 p=make_parts(base,view);frames=[];direction=1 if view=='back' else -1
 for i in range(8):
  phase=2*math.pi*i/8;bob=[1,0,-1,0,1,0,-1,0][i];f=Image.new('RGBA',(256,256))
  f.alpha_composite(rot(p['tail'],2*math.sin(phase),(141 if view=='back' else 101,178)))
  f.alpha_composite(rot(p['far'],-8*math.sin(phase),(154,141)))
  # Small depth stride. During stance the shoe stays flat; swing lifts it.
  for li in [1,0]:
   q=(i+(4 if li else 0))%8;t=2*math.pi*q/8
   depth=[-9,-3,3,9,9,3,-3,-9][q];lift=[0,0,0,0,3,6,5,2][q]
   ax0,ay0=p['ankles'][li];ax=ax0+direction*depth*.45;ay=ay0+direction*depth-lift
   bend=direction*max(0,math.sin(t))*2
   hx,hy=p['hips'][li];sx,sy=p['ankles'][li];yscale=(ay-hy)/(sy-hy);shear=(ax-sx)/(sy-hy)
   warped=p['legs'][li].transform((256,256),Image.Transform.AFFINE,(1,-shear/yscale,shear*hy/yscale,0,1/yscale,hy-hy/yscale),Image.Resampling.BICUBIC)
   f.alpha_composite(warped,(0,bob))
  f.alpha_composite(p['core'],(0,bob));f.alpha_composite(rot(p['near'],8*math.sin(phase),(99,140)),(0,bob))
  # One pixel grid shared by source and rigged limbs.
  frames.append(f.resize((128,128),Image.Resampling.LANCZOS).resize((256,256),Image.Resampling.NEAREST))
 return frames
frames=walk(back,'back')+walk(front,'front')+[back,Image.open(art/'base-2.png').convert('RGBA'),Image.open(art/'base-3.png').convert('RGBA'),front]
frames=[f.resize((128,128),Image.Resampling.LANCZOS).resize((256,256),Image.Resampling.NEAREST) for f in frames]
sheet=Image.new('RGBA',(1280,1024))
for i,f in enumerate(frames):sheet.alpha_composite(f,((i%5)*256,(i//5)*256))
sheet.save(out/'chota-directional-v1.webp',lossless=True,method=6);sheet.save(art/'chota-directional-v1.png')
contact=Image.new('RGB',(1280,1120),'#1b222b');d=ImageDraw.Draw(contact)
for i,f in enumerate(frames):
 x=(i%5)*256;y=(i//5)*280;contact.paste(f,(x,y),f);d.text((x+10,y+256),f'{i:02d} '+('ALEJARSE' if i<8 else 'VOLVER' if i<16 else ['PARADO ESPALDA','ALCANZAR','PULSAR','PARADO FRENTE'][i-16]),fill='white')
contact.save(art/'contact-sheet.png')
image=ET.Element('image',w='256',h='256',name='El Chota · caminar hacia el fondo y volver');stack=ET.SubElement(image,'stack')
with zipfile.ZipFile(art/'chota-directional-v1.ora','w') as z:
 z.writestr('mimetype','image/openraster')
 for i,f in reversed(list(enumerate(frames))):
  data=BytesIO();f.save(data,format='PNG');path=f'data/frame-{i:02d}.png';z.writestr(path,data.getvalue());ET.SubElement(stack,'layer',{'name':f'{i:02d} '+('Alejarse 3/4 espalda' if i<8 else 'Volver 3/4 frente' if i<16 else 'Parado espalda' if i==16 else 'Alcanzar interruptor' if i==17 else 'Pulsar interruptor' if i==18 else 'Parado frente'),'src':path,'opacity':'1.0','visibility':'visible' if i==0 else 'hidden','composite-op':'svg:src-over','x':'0','y':'0'})
 z.writestr('stack.xml',ET.tostring(image));data=BytesIO();frames[0].save(data,format='PNG');z.writestr('mergedimage.png',data.getvalue())
print(art/'contact-sheet.png')
