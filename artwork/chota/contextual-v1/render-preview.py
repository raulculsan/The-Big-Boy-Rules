from PIL import Image,ImageDraw,ImageFont,ImageEnhance
from pathlib import Path
import math,subprocess,json
root=Path(__file__).resolve().parents[3];out=Path('/Users/raulculsan/Documents/Codex/2026-10-06/se/chota-contextual-preview');out.mkdir(exist_ok=True)
ffmpeg='/Users/raulculsan/Documents/Codex/2026-10-06/se/trailer-bigboy/audio-v2/deps/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'
room=Image.open(root/'icons/clubhouse/club-room-v1.webp').convert('RGBA').resize((720,720));sheet=Image.open(root/'icons/mascot/chota-v2/chota-contextual-v1.webp').convert('RGBA');frames=[sheet.crop(((i%4)*256,(i//4)*256,(i%4+1)*256,(i//4+1)*256)) for i in range(16)]
old=Image.open(root/'icons/mascot/chota-v2/chota-poses.webp').convert('RGBA');greet=[old.crop((i*256,0,(i+1)*256,256)) for i in range(6)]
core=Image.open(root/'icons/mascot/chota-v2/chota-idle-core-v1.webp').convert('RGBA');tail=Image.open(root/'icons/mascot/chota-v2/chota-idle-tail-v1.webp').convert('RGBA');ears=[Image.open(root/f'icons/mascot/chota-v2/chota-idle-ear-{side}-v1.webp').convert('RGBA') for side in ['left','right']]
vac=Image.open(root/'icons/clubhouse/props/robot-vacuum-v2.png').convert('RGBA').resize((94,63));font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',20);small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',12);note=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',15)
seqs={'plan':[(0,180),(1,200),(2,950),(3,550),(2,700),(1,180),(0,180)],'scratch':[(0,150),(1,200),(2,300),(3,180),(2,180),(3,180),(2,280),(1,200),(0,180)],'stretch':[(0,180),(1,220),(2,850),(3,650),(2,350),(1,220),(0,180)],'shirt':[(0,180),(2,350),(3,220),(2,320),(3,180),(2,250),(0,220)]}
rows={'plan':0,'scratch':1,'stretch':2,'shirt':3}
def pose(action,e):
 end=0
 for col,hold in seqs[action]:
  end+=hold
  if e*1000<end:return frames[rows[action]*4+col]
 return frames[0]
def ease(x):x=max(0,min(1,x));return x*x*(3-2*x)
def idle(t,kind='',e=0):
 body=core.copy();body.paste((0,0,0,0),(0,0,256,133));head=core.copy();head.paste((0,0,0,0),(0,138,256,256))
 for ear in ears:head.alpha_composite(ear)
 q=math.sin(math.pi*min(1,e/3.8)) if kind else 0;direction=max(-1,min(1,(440-(t-10)*23+47-360)/160)) if kind=='roomba' else 1
 head=head.rotate(-direction*1.8*q,Image.Resampling.BICUBIC,center=(146,133));f=Image.new('RGBA',(256,256));f.alpha_composite(tail.rotate(2*math.sin(t*1.2),Image.Resampling.BICUBIC,center=(92,184)));f.alpha_composite(body);f.alpha_composite(head,(round(direction*2*q),round((2 if kind=='roomba' else -2)*q)));return f
schedule=[(1,'plan','Mira el próximo plan'),(6,'window','Nota que cambia la luz'),(11,'roomba','Sigue la Roomba cercana'),(17,'scratch','Se rasca una oreja'),(22,'stretch','Se despereza en una pausa'),(27,'shirt','Se acomoda la camiseta'),(32,'user','Reacciona cuando lo tocas')]
fps=30;duration=36
proc=subprocess.Popen([ffmpeg,'-y','-f','rawvideo','-pix_fmt','rgb24','-s','720x806','-r',str(fps),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'chota-atento-al-entorno-v1.mp4')],stdin=subprocess.PIPE,stderr=subprocess.PIPE)
for i in range(duration*fps):
 t=i/fps;active=[x for x in schedule if x[0]<=t];start,action,label=active[-1] if active else (0,'','Respira mientras espera');e=t-start
 art=room.copy();d=ImageDraw.Draw(art);d.rounded_rectangle((147,180,349,303),radius=1,fill='#f1e0b5');d.text((161,204),'Cumpleaños',font=note,fill='#292621');d.text((161,231),'Mañana · 19:00',font=note,fill='#443c33')
 # An owned Roomba passes through the field of attention; no personal data in preview.
 if 10<=t<=16:art.alpha_composite(vac,(round(440-(t-10)*23),574))
 if action in rows:sprite=pose(action,e)
 elif action in ['window','roomba'] and e<4:sprite=idle(t,action,e)
 elif action=='user' and e<2.6:
  cycle=[0,1,2,3,4,3,4,2,5,1,0];sprite=greet[cycle[min(len(cycle)-1,int(e/2.6*len(cycle)))]]
 else:sprite=idle(t)
 sprite=sprite.resize((202,202),Image.Resampling.NEAREST);d=ImageDraw.Draw(art);d.ellipse((304,579,421,585),fill=(0,0,0,55));art.alpha_composite(sprite,(259,386))
 frame=Image.new('RGB',(720,806),'#101216');frame.paste(art.convert('RGB'),(0,70));d=ImageDraw.Draw(frame);d.text((20,13),'El Chota · atento a su habitación',font=font,fill='#f6f0e5');d.text((20,43),label,font=small,fill='#b8b7b2');d.text((20,790),'Vista previa renderizada · pausas entre acciones abreviadas',font=small,fill='#a6a7aa')
 # yuv420p requires even dimensions.
 if i==0:frame.save(out/'poster.png')
 if i in [60,210,390,540,720,870]:frame.save(out/f'check-{i//30:02d}.png')
 proc.stdin.write(frame.tobytes())
proc.stdin.close();err=proc.stderr.read().decode();code=proc.wait()
if code:raise RuntimeError(err)
(out/'preview-info.json').write_text(json.dumps({'width':720,'height':806,'duration':36,'render':'Rendered current sprite actions and attention examples. Waiting gaps shortened. Not iPhone capture.'},indent=2));print(out/'chota-atento-al-entorno-v1.mp4')
