import sys
from PIL import Image, ImageFilter, ImageDraw
U=(sys.argv[2].rstrip('/')+'/') if len(sys.argv)>2 else './'  # folder holding the three reference screenshots
S=1290/923
OUT=sys.argv[1]
# display-pixel boxes (x0,y0,x1,y1) for each badge illustration
seps={'faith':[378,537,698,864,1032,1198,1372,1545,1720,1935],
      'food':[322,485,646,812,980,1146,1318,1492,1667,1890],
      'fitness':[275,435,597,763,930,1097,1270,1442,1617,1835]}
xr={'faith':(140,450),'food':(180,460),'fitness':(108,345)}
over={('food',9):(165,1585,475,1885),('food',8):(180,1488,460,1640),('fitness',9):(100,1605,350,1840),('faith',9):(120,1718,470,1935)}
src={'faith':'e5966b35-image.png','food':'8bbd262a-image.png','fitness':'2e9bba89-image.png'}
for cat in src:
    im=Image.open(U+src[cat]).convert('RGB')
    for lv in range(1,10):
        y0,y1=seps[cat][lv-1]+5,seps[cat][lv]-5
        x0,x1=xr[cat]
        box=over.get((cat,lv),(x0,y0,x1,y1))
        c=im.crop(tuple(int(v*S) for v in box))
        w,h=c.size; side=max(w,h)
        canvas=Image.new('RGB',(side,side),(8,7,5))
        canvas.paste(c,((side-w)//2,(side-h)//2))
        # feathered mask: soft rounded square so the art's dark background melts into the app
        m=Image.new('L',(side,side),0); d=ImageDraw.Draw(m)
        inset=int(side*0.06)
        d.rounded_rectangle(((side-w)//2+inset,(side-h)//2+inset,(side+w)//2-inset,(side+h)//2-inset),radius=int(side*0.18),fill=255)
        m=m.filter(ImageFilter.GaussianBlur(side*0.05))
        canvas.putalpha(m)
        canvas=canvas.resize((512,512),Image.LANCZOS)
        canvas.save(f'{OUT}/{cat}-{lv}.webp','WEBP',quality=90,method=6)
print('ok')
