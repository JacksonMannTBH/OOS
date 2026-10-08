from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
S = 3
canvas = Image.new('RGB', (1024*S, 500*S), 'black')
# Real browser screenshot, cropped to omit site controls. No generated map data.
shot = Image.open(HERE / 'live-map-capture.jpg').convert('RGB')
map_image = shot.crop((350, 130, 1190, 700)).resize((737*S, 500*S), Image.Resampling.LANCZOS)
mask = Image.new('L', map_image.size)
pixels = mask.load()
for x in range(mask.width):
    position = x/S + 287
    opacity = max(0, min(1, (position-360)/210))
    opacity = opacity*opacity*(3-2*opacity)
    for y in range(mask.height):
        pixels[x,y] = round(255*opacity)
canvas.paste(map_image, (287*S,0), mask)
logo = Image.open(ROOT / 'public/icons/out-of-sight-logo.jpg').convert('RGB')
logo = logo.crop((194,324,830,701)).resize((127*S,75*S), Image.Resampling.LANCZOS)
canvas.paste(logo,(55*S,65*S))
draw = ImageDraw.Draw(canvas)
headline = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',60*S)
for text,y,color in [('Stay Safe.',185,'#FFFFFF'),('Stay Out',258,'#F4CA28'),('Of Sight.',325,'#F4CA28')]:
    draw.text((52*S,y*S),text,font=headline,fill=color,anchor='lt',stroke_width=0)
# Preserve visible attribution for the source map in the exported composition.
credit = 'OpenFreeMap | © OpenMapTiles | © OpenStreetMap'
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf',9*S)
box = draw.textbbox((0,0),credit,font=font)
width = box[2]-box[0]
draw.rectangle((1024*S-width-20*S,478*S,1024*S,500*S),fill='#000000')
draw.text((1013*S,486*S),credit,font=font,fill='#C8CAC7',anchor='rt')
canvas.resize((1024,500),Image.Resampling.LANCZOS).save(HERE/'out-of-sight-real-map-banner-1024x500.png')
print(HERE/'out-of-sight-real-map-banner-1024x500.png')
