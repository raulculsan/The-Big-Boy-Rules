from PIL import Image,ImageDraw,ImageFont,ImageEnhance,ImageOps
from pathlib import Path
import math,subprocess,json
root=Path(__file__).resolve().parents[3];out=Path('/Users/raulculsan/Documents/Codex/2026-10-06/se/chota-lateral-preview');out.mkdir(exist_ok=True)
ffmpeg='/Users/raulculsan/Documents/Codex/2026-10-06/se/trailer-bigboy/audio-v2/deps/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'
room=Image.open(root/'icons/clubhouse/club-room-v1.webp').convert('RGB').resize((720,720))
sheet=Image.open(root/'icons/mascot/chota-v2/chota-poses.webp').convert('RGBA');front=[sheet.crop(((i%6)*256,(i//6)*256,(i%6+1)*256,(i//6+1)*256)) for i in range(24)]
sheet=Image.open(root/'icons/mascot/chota-v2/chota-lateral-v1.webp').convert('RGBA');side=[sheet.crop(((i%6)*256,(i//6)*256,(i%6+1)*256,(i//6+1)*256)) for i in range(12)]
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',22)
fps=30;start=.8;duration=14.5;w=201.6;ph=225.6;px=.36*720;py=720-.15*720-ph;scale=.68
switch=(.3185*720,.4995*720)
dx=switch[0]-px-w/2-(w*20/256-w/2)*scale
dy=switch[1]-py-ph-(w*88/256-ph)*scale

def easing(p):p=max(0,min(1,p));return p*p*(3-2*p)
def phase(e):
 if e<200:return side[8],0,False
 if e<2600:return side[int((e-200)//145)%8],(e-200)/2400,False
 if e<2900:return side[8],1,False
 if e<3250:return side[9],1,False
 if e<3550:return side[10],1,False
 if e<3800:return side[9],1,False
 if e<4050:return side[8],1,False
 if e<4350:return side[8],1,True
 if e<6750:return side[int((e-4350)//145)%8],1-(e-4350)/2400,True
 if e<6950:return side[8],0,True
 if e<7150:return front[0],0,False
 return front[18 if e<7700 else 19 if e<8600 else 20 if e<9750 else 21 if e<11400 else 22],0,False
proc=subprocess.Popen([ffmpeg,'-y','-f','rawvideo','-pix_fmt','rgb24','-s','720x790','-r',str(fps),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'chota-interruptor-v2.mp4')],stdin=subprocess.PIPE,stderr=subprocess.PIPE)
for i in range(math.ceil(duration*fps)):
 t=i/fps;e=max(0,(t-start)*1000);fade=easing((e-3350)/3000)
 art=room.convert('RGBA');d=ImageDraw.Draw(art)
 x0=.307*720;y0=.482*720;x1=x0+.023*720;y1=y0+.035*720
 d.rectangle((x0+1,y0+2,x1+2,y1+2),fill=(8,11,19,130));d.rectangle((x0,y0,x1,y1),fill='#b8ac92',outline='#34322c',width=1)
 d.rectangle((x0+4,y0+5,x1-4,y1-5),fill='#d1c5a8' if e<3350 else '#a1957d',outline='#686052');d.line((x0+4,(y0+y1)/2,x1-4,(y0+y1)/2),fill='#686052')
 art=ImageEnhance.Color(art).enhance(1-.72*fade);art=ImageEnhance.Brightness(art).enhance(1-.71*fade)
 art=Image.alpha_composite(art,Image.new('RGBA',(720,720),(11,16,33,round(255*(.12+.24*fade)))))
 sprite,q,mirror=phase(e);sprite=ImageOps.mirror(sprite) if mirror else sprite
 sc=1-(1-scale)*q;sw=round(w*sc)
 sprite=ImageEnhance.Color(sprite).enhance(1-.3*fade);sprite=ImageEnhance.Brightness(sprite).enhance(1-.28*fade);sprite=sprite.resize((sw,sw),Image.Resampling.NEAREST)
 x=round(px+w/2-w/2*sc+dx*q);y=round(py+ph-ph*sc+dy*q)
 d=ImageDraw.Draw(art);d.ellipse((x+sw*.22,y+sw*.95,x+sw*.8,y+sw*.98),fill=(0,0,0,55));art.alpha_composite(sprite,(x,y))
 frame=Image.new('RGB',(720,790),'#101216');frame.paste(art.convert('RGB'),(0,70));d=ImageDraw.Draw(frame);d.text((24,22),'El Chota · paseo e interruptor',font=font,fill='#f6f0e5')
 if i==0:frame.save(out/'poster.png')
 if abs(e-3400)<1000/fps:frame.save(out/'press-check.png')
 if abs(e-1500)<1000/fps:frame.save(out/'walking-check.png')
 proc.stdin.write(frame.tobytes())
proc.stdin.close();err=proc.stderr.read().decode();code=proc.wait()
if code:raise RuntimeError(err)
(out/'preview-info.json').write_text(json.dumps({'render':'Sprites and current code timing rendered for review, not iPhone capture','width':720,'height':790,'duration':duration,'finger':switch,'destination':[dx,dy,scale]},indent=2));print(out/'chota-interruptor-v2.mp4')
