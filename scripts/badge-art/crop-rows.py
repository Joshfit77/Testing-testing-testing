import sys
from PIL import Image, ImageFilter, ImageDraw, ImageChops
U=(sys.argv[2].rstrip('/')+'/') if len(sys.argv)>2 else './'
OUT=sys.argv[1]
S=1290/923
seps={'faith':[378,537,698,864,1032,1198,1372,1545,1720,1935],'food':[322,485,646,812,980,1146,1318,1492,1667,1890]}
xr={'faith':(145,450),'food':(178,462)}
over={('food',9):(1606,1890),('food',8):(1494,1645),('faith',9):(1722,1940)}
src={'faith':'e5966b35-image.png','food':'8bbd262a-image.png'}
for cat in src:
    im=Image.open(U+src[cat]).convert('RGB')
    for lv in range(1,10):
        y0,y1=over.get((cat,lv),(seps[cat][lv-1]+4,seps[cat][lv]-4))
        x0,x1=xr[cat]
        c=im.crop(tuple(int(v*S) for v in (x0,y0,x1,y1)))
        c=c.resize((560,int(560*c.size[1]/c.size[0])),Image.LANCZOS)
        w,h=c.size
        m=Image.new('L',(w,h),0); d=ImageDraw.Draw(m)
        d.rounded_rectangle((18,8,w-18,h-8),radius=26,fill=255)
        m=m.filter(ImageFilter.GaussianBlur(10))
        c.putalpha(m)
        c.save(f'{OUT}/{cat}-{lv}.webp','WEBP',quality=90,method=6)
print('ok')
