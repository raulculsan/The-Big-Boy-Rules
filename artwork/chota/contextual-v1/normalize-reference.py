from PIL import Image,ImageDraw
from pathlib import Path
root=Path(__file__).resolve().parents[3];p=Path(__file__).parent;im=Image.open(p/'gesture-reference.png').convert('RGBA');w,h=im.size
sheet=Image.new('RGBA',(1024,256));contact=Image.new('RGB',(1024,280),'#1b222b')
for i in range(4):
 c=im.crop(((i%2)*w//2,(i//2)*h//2,(i%2+1)*w//2,(i//2+1)*h//2));c.putalpha(c.getchannel('A').point(lambda v:255 if v>120 else 0));b=c.getbbox();c=c.crop(b);scale=214/c.height;c=c.resize((round(c.width*scale),214),Image.Resampling.NEAREST);f=Image.new('RGBA',(256,256));f.alpha_composite(c,((256-c.width)//2,28));f=f.resize((128,128),Image.Resampling.LANCZOS).resize((256,256),Image.Resampling.NEAREST);f.save(p/f'base-{i}.png');contact.paste(f,(i*256,0),f);ImageDraw.Draw(contact).text((i*256+10,260),str(i),fill='white')
contact.save(p/'bases.png')
