import sys
from PIL import Image, ImageFilter, ImageDraw
U=(sys.argv[2].rstrip('/')+'/') if len(sys.argv)>2 else './'  # folder holding the three reference screenshots
S=1290/923
OUT=sys.argv[1]
seps={'faith':[378,537,698,864,1032,1198,1372,1545,1720,1935],'food':[322,485,646,812,980,1146,1318,1492,1667,1890]}
cx={'faith':295,'food':318}
side_d={'faith':225,'food':205}
yoff={('food',9):35,('food',8):-10,('faith',9):5,('faith',4):0}
BAND={('food',9):(1640,1890),('food',8):(1494,1640),('faith',9):(1724,1960)}
src={'faith':'e5966b35-image.png','food':'8bbd262a-image.png'}
for cat in src:
    im=Image.open(U+src[cat]).convert('RGB')
    for lv in range(1,10):
        sd=side_d[cat]*(1.25 if (cat,lv)==('food',9) else 1.12 if (cat,lv)==('faith',9) else 1)
        cy=(seps[cat][lv-1]+seps[cat][lv])/2+yoff.get((cat,lv),0)
        box=(cx[cat]-sd/2, cy-sd/2, cx[cat]+sd/2, cy+sd/2)
        c=im.crop(tuple(int(v*S) for v in box)).resize((512,512),Image.LANCZOS)
        m=Image.new('L',(512,512),0); d=ImageDraw.Draw(m)
        d.ellipse((40,40,472,472),fill=255)
        m=m.filter(ImageFilter.GaussianBlur(34))
        # Keep only this row: fade out above/below the gold dividers (and the neighbouring rows' art).
        top,bot=BAND.get((cat,lv),(seps[cat][lv-1]+9,seps[cat][lv]-9))
        to_px=lambda yd:(yd-box[1])/(box[3]-box[1])*512
        band=Image.new('L',(512,512),0); bd=ImageDraw.Draw(band)
        bd.rectangle((0,max(0,to_px(top)+10),512,min(512,to_px(bot)-10)),fill=255)
        band=band.filter(ImageFilter.GaussianBlur(9))
        from PIL import ImageChops
        m=ImageChops.multiply(m,band)
        c.putalpha(m)
        c.save(f'{OUT}/{cat}-{lv}.webp','WEBP',quality=90,method=6)
print('ok')
