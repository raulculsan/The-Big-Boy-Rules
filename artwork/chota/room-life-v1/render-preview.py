from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math, subprocess
art=Path(__file__).parent;root=art.parents[2]
out=Path('/Users/raulculsan/Documents/Codex/2026-10-06/se/chota-room-life-preview');out.mkdir(exist_ok=True)
room=Image.open(root/'icons/clubhouse/club-room-v1.webp').convert('RGBA').resize((720,720))
sheet=Image.open(root/'icons/mascot/chota-v2/chota-directional-v1.webp').convert('RGBA')
walk=[sheet.crop(((i%5)*256,(i//5)*256,(i%5+1)*256,(i//5+1)*256)) for i in range(20)]
seats=Image.open(root/'icons/mascot/chota-v2/chota-room-life-v1.webp').convert('RGBA')
seats=[seats.crop((i*256,0,(i+1)*256,256)) for i in range(4)]
stand=Image.open(root/'artwork/chota/directional-v1/standing-reference.png').convert('RGBA')
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',20)
small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',12)
home=(.5,.80,.32)
def mix(a,b,p):
 p=max(0,min(1,p));return tuple(x+(y-x)*p for x,y in zip(a,b))
def gait(a,b,p,t,away):
 frame=walk[(0 if away else 8)+int(t/.125)%8]
 if (b[0]>a[0] if away else b[0]<a[0]):frame=frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
 return frame,mix(a,b,p),False
def scene(kind,t):
 target=(.77,.605,.225) if kind=='window' else ((.345,.605,.235) if kind=='board' else (.145,.667,.24));approach=(.16,.705,.24)
 if kind in ('window','board'):
  travel,pause=(4.3,4.5) if kind=='board' else (5.6,5.8)
  if t<travel:return gait(home,target,t/travel,t,True)
  if t<travel+pause:
   if kind=='board':frame=walk[17 if travel+2.4<t<travel+3.3 else 16]
   else:frame=walk[19 if 9.7<t<10.5 else 16].transpose(Image.Transpose.FLIP_LEFT_RIGHT)
   return frame,target,False
  if t<travel*2+pause:return gait(target,home,(t-travel-pause)/travel,t-travel-pause,False)
 else:
  if t<4.9:return gait(home,approach,t/4.9,t,True)
  if t<5.35:return walk[19],approach,False
  if t<6.1:return seats[0],mix(approach,target,(t-5.35)/.75),True
  if t<13.5:return seats[2 if 8<t<11.7 else 1],target,True
  if t<14.5:return seats[3 if t<14.2 else 0],mix(target,approach,t-13.5),True
  if t<15.7:return walk[19],approach,False
  if t<20.6:return gait(approach,home,(t-15.7)/4.9,t-15.7,False)
 return stand,home,False
def render(kind,t):
 sprite,point,sofa=scene(kind,t);x,y,w=point;size=round(w*720)
 image=room.copy();d=ImageDraw.Draw(image)
 if not sofa:d.ellipse((x*720-w*720*.24,y*720-2,x*720+w*720*.24,y*720+2),fill=(0,0,0,65))
 sprite=sprite.resize((size,size),Image.Resampling.NEAREST)
 image.alpha_composite(sprite,(round(x*720-size*.5),round(y*720-size*.945)))
 if sofa:
  mask=Image.new('L',(720,720));md=ImageDraw.Draw(mask);md.polygon([(0,.57*720),(.048*720,.59*720),(.068*720,.64*720),(.075*720,.69*720),(0,.74*720)],fill=255)
  image=Image.composite(room,image,mask)
 frame=Image.new('RGB',(720,806),'#101216');frame.paste(image.convert('RGB'),(0,70));d=ImageDraw.Draw(frame)
 d.text((20,13),'El Chota · se mueve por la habitación',font=font,fill='#f6f0e5')
 d.text((20,43),{'window':'Se acerca a la ventana','sofa':'Se sienta en el sofá izquierdo','board':'Mira el próximo plan'}[kind],font=small,fill='#b8b7b2')
 d.text((20,790),'Vista previa renderizada · mismos sprites y recorridos de la app',font=small,fill='#a6a7aa')
 return frame
checks=[('window',3),('window',7),('window',13),('sofa',4),('sofa',5.7),('sofa',9),('sofa',14),('sofa',18),('board',6),('board',7.2)]
for kind,t in checks:render(kind,t).save(out/f'{kind}-{str(t).replace(".","-")}.png')
render('sofa',9).save(out/'poster.png')
ffmpeg='/Users/raulculsan/Documents/Codex/2026-10-06/se/trailer-bigboy/audio-v2/deps/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'
fps=30;duration=53
p=subprocess.Popen([ffmpeg,'-y','-f','rawvideo','-pix_fmt','rgb24','-s','720x806','-r',str(fps),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'chota-ventana-sofa-v1.mp4')],stdin=subprocess.PIPE,stderr=subprocess.PIPE)
for i in range(fps*duration):
 t=i/fps;kind='window' if t<18 else ('sofa' if t<39 else 'board');p.stdin.write(render(kind,t if kind=='window' else (t-18 if kind=='sofa' else t-39)).tobytes())
p.stdin.close();err=p.stderr.read().decode();code=p.wait()
if code:raise RuntimeError(err)
print(out/'chota-ventana-sofa-v1.mp4')
