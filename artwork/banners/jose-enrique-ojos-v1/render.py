"""Rebuild José Enrique's six-second 3:1 banner animation locally."""
from pathlib import Path
import json
import math
import shutil
import subprocess
import zipfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
OUT = REPO / 'icons/banners/jose-enrique-ojos-v1'
FF = '/Applications/krita.app/Contents/MacOS/ffmpeg'
SOURCE = ROOT / 'source.png'
W, H = 1440, 480
FPS, SECONDS = 24, 6


def run(*args):
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y', *map(str, args)], check=True)


def smooth(a, b, t):
    v = max(0, min(1, (t - a) / (b - a)))
    return v * v * (3 - 2 * v)


def mask_polygon(points, blur=0):
    mask = Image.new('L', (2172, 724))
    ImageDraw.Draw(mask).polygon(points, fill=255)
    if blur:
        mask = mask.filter(ImageFilter.GaussianBlur(blur))
    return mask


def array(mask):
    return np.asarray(mask.resize((W, H), Image.Resampling.LANCZOS), dtype=np.float32)[..., None] / 255


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    base_image = Image.open(SOURCE).convert('RGB')
    assert base_image.size == (2172, 724)
    # Masks follow the visible eye apertures, beneath the existing upper lids.
    eyes = mask_polygon([(1040, 258), (1052, 254), (1064, 255), (1076, 259), (1086, 264), (1095, 270), (1083, 273), (1068, 271), (1054, 267), (1045, 263)])
    other = mask_polygon([(1175, 278), (1186, 272), (1198, 269), (1210, 270), (1222, 276), (1235, 283), (1224, 287), (1211, 288), (1197, 286), (1184, 282)])
    eyes = Image.fromarray(np.maximum(np.asarray(eyes), np.asarray(other)))
    eyes.save(ROOT / 'eye-apertures.png')
    iris = Image.new('L', (2172, 724))
    draw = ImageDraw.Draw(iris)
    draw.ellipse((1058, 251, 1078, 271), fill=255)
    draw.ellipse((1194, 265, 1216, 285), fill=255)
    iris = Image.fromarray(np.minimum(np.asarray(iris), np.asarray(eyes)))
    iris.save(ROOT / 'eye-cores.png')
    aperture = array(eyes.filter(ImageFilter.GaussianBlur(.65)))
    core = array(iris.filter(ImageFilter.GaussianBlur(1)))
    near = array(eyes.filter(ImageFilter.GaussianBlur(6)))
    halo = array(eyes.filter(ImageFilter.GaussianBlur(21)))
    bounce = array(eyes.filter(ImageFilter.GaussianBlur(44)))
    # Light bleed lands on the adjacent cap brim and mask; it is strongest
    # nearest the eyes and never shifts or replaces the face illustration.
    base = np.asarray(base_image.resize((W, H), Image.Resampling.LANCZOS), dtype=np.float32) / 255
    yy, xx = np.mgrid[0:H, 0:W]
    side = np.clip((np.abs(xx - W / 2) - 210) / 210, 0, 1)[..., None]
    neon = np.exp(-((xx - 150) / 200) ** 2)[..., None] * np.array([.01, .032, .052]) + np.exp(-((xx - 1220) / 200) ** 2)[..., None] * np.array([.035, .008, .044])
    rng = np.random.default_rng(26)
    # Painted rain belongs to the tunnel depth: a soft subject matte keeps
    # distant streaks behind his hood and shoulders, with a few close drops.
    subject = mask_polygon([(925, 0), (1300, 0), (1320, 130), (1335, 350),
                            (1315, 485), (1525, 724), (280, 724), (430, 540),
                            (650, 425), (765, 410), (780, 220), (835, 80)], 8)
    background = 1 - array(subject)
    face = Image.new('L', (2172, 724))
    ImageDraw.Draw(face).ellipse((940, 150, 1310, 510), fill=255)
    face_guard = 1 - array(face.filter(ImageFilter.GaussianBlur(28)))
    layers = []
    for count, length, cycles, opacity, width, blur in [
        (210, (7, 15), 3, (38, 72), 1, 0),
        (105, (16, 30), 5, (62, 115), 1, .25),
        (30, (28, 46), 7, (65, 115), 2, .45),
    ]:
        drops = [(float(rng.uniform(-20, W + 20)), float(rng.uniform(0, H + 100)),
                  float(rng.uniform(*length)), int(rng.uniform(*opacity)),
                  float(rng.uniform(0, 2 * math.pi))) for _ in range(count)]
        layers.append((drops, cycles, width, blur))
    ripples = [(float(rng.choice([rng.uniform(20, 290), rng.uniform(1050, 1420)])),
                float(rng.uniform(365, 475)), float(rng.uniform(0, 1))) for _ in range(22)]
    # Impacts occur only on the visible wet floor, outside the subject matte.
    impacts = [(float(rng.choice([rng.uniform(18, 220), rng.uniform(1060, 1420)])),
                float(rng.uniform(335, 472)), float(rng.uniform(0, 2)),
                float(rng.uniform(.7, 1.25))) for _ in range(36)]
    mp4 = OUT / 'jose-enrique-ojos-v2.mp4'
    encoder = subprocess.Popen([FF, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libopenh264', '-b:v', '1800k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(mp4)], stdin=subprocess.PIPE)
    selected = {}
    for index in range(FPS * SECONDS):
        t = index / FPS
        envelope = smooth(.7, 2.2, t) * (1 - smooth(3.7, 5.35, t))
        strength = envelope * (1 + .025 * math.sin(2 * math.pi * t * 2))
        frame = base.copy()
        # Soft screen light preserves the painted texture. The iris cores
        # become icy white while the aperture and reflected light stay cyan.
        light = (aperture * np.array([.10, .48, .64]) + core * np.array([.35, .43, .43]) + near * np.array([.10, .45, .58]) + halo * np.array([.16, .58, .72]) + bounce * np.array([.10, .38, .52])) * strength
        frame = 1 - (1 - frame) * (1 - np.clip(light, 0, .96))
        ambience = (.5 + .5 * math.sin(2 * math.pi * t / SECONDS)) * neon * side
        frame = np.clip(frame + ambience, 0, 1)
        for depth, (drops, cycles, width, blur) in enumerate(layers):
            rain = Image.new('L', (W, H))
            rd = ImageDraw.Draw(rain)
            for x, y, length, opacity, phase in drops:
                py = (y + (H + 100) * cycles * t / SECONDS) % (H + 100) - 50
                px = x + 3 * math.sin(2 * math.pi * t / SECONDS + phase)
                rd.line((px, py, px - length * .17, py + length), fill=opacity, width=width)
            if blur:
                rain = rain.filter(ImageFilter.GaussianBlur(blur))
            rain_arr = np.asarray(rain, dtype=np.float32)[..., None] / 255
            rain_arr *= background if depth < 2 else (.3 + .7 * background) * face_guard
            rain_color = np.array([.40, .68, .95])
            frame = 1 - (1 - frame) * (1 - rain_arr * rain_color)
        puddles = Image.new('L', (W, H))
        pd = ImageDraw.Draw(puddles)
        for x, y, phase in ripples:
            age = (t / 1.5 + phase) % 1
            radius = 1 + age * 12
            alpha = round(45 * math.sin(math.pi * age) ** 2)
            pd.ellipse((x - radius, y - radius * .16, x + radius, y + radius * .16), outline=alpha, width=1)
        # A descending drop meets each impact, followed by a short crown, ballistic
        # droplets and expanding perspective-flattened rings. Every cycle divides
        # the six-second loop exactly so there is no end/start jump.
        for x, y, phase, scale in impacts:
            age = (t + phase) % 2
            perspective = (.55 + .65 * (y - 335) / 137) * scale
            if age < .16:
                drop_y = y - 65 * (1 - age / .16)
                pd.line((x + 4, drop_y - 10, x, drop_y), fill=120, width=1)
            impact_age = age - .16
            if 0 <= impact_age < .65:
                u = impact_age / .65
                radius = (1 + 19 * u) * perspective
                alpha = round(115 * (1 - u) ** 1.4)
                pd.ellipse((x-radius, y-radius*.19, x+radius, y+radius*.19), outline=alpha, width=1)
                if u > .14:
                    inner = radius * .52
                    pd.ellipse((x-inner, y-inner*.19, x+inner, y+inner*.19), outline=alpha//2, width=1)
                if impact_age < .31:
                    jump = impact_age / .31
                    for direction in (-1, -.5, .45, 1):
                        dx = direction * 13 * perspective * jump
                        dy = -38 * perspective * jump * (1-jump)
                        px, py = x + dx, y + dy
                        pd.line((px, py, px-direction*1.5, py+2*perspective), fill=round(190*(1-jump)), width=1)
                    if jump < .45:
                        crown = 5 * perspective * jump / .45
                        pd.line((x-crown, y-1, x-crown*.65, y-4*perspective, x, y-1,
                                 x+crown*.65, y-4*perspective, x+crown, y-1), fill=round(150*(1-jump)), width=1)
        puddle_arr = np.asarray(puddles.filter(ImageFilter.GaussianBlur(.3)), dtype=np.float32)[..., None] / 255 * background
        frame = np.clip(frame + puddle_arr * np.array([.35, .56, .82]), 0, 1)
        rgb = np.uint8(frame * 255 + .5)
        encoder.stdin.write(rgb.tobytes())
        if index in (0, 24, 58, 96, 143):
            selected[index] = Image.fromarray(rgb)
    encoder.stdin.close()
    if encoder.wait() != 0:
        raise RuntimeError('Video encoding failed')
    base_image.save(OUT / 'poster.jpg', quality=94, subsampling=0)
    selected[58].resize((2172, 724), Image.Resampling.LANCZOS).save(OUT / 'poster-glow.jpg', quality=94, subsampling=0)
    selected[58].save(ROOT / 'glow-frame.png')
    for index in (0, 24, 96, 143):
        selected[index].save(ROOT / f'rain-check-{index:03}.png')
    run('-i', mp4, '-vf', 'fps=12,scale=1086:362:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', OUT / 'jose-enrique-ojos-v2.gif')
    # Editable compositing document for Krita alongside the reproducible render.
    xml = '''<?xml version="1.0" encoding="UTF-8"?><image version="0.0.3" w="2172" h="724" name="José Enrique · Ojos"><stack><layer name="Máscara · núcleo de ojos" src="data/core.png" opacity="1.0" visibility="hidden" composite-op="svg:src-over"/><layer name="Máscara · abertura de ojos" src="data/eyes.png" opacity="1.0" visibility="hidden" composite-op="svg:src-over"/><layer name="Ilustración base 3:1" src="data/source.png" opacity="1.0" visibility="visible" composite-op="svg:src-over"/></stack></image>'''
    with zipfile.ZipFile(ROOT / 'jose-enrique-ojos-v1.ora', 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('mimetype', 'image/openraster', compress_type=zipfile.ZIP_STORED)
        z.writestr('stack.xml', xml)
        z.write(SOURCE, 'data/source.png')
        z.write(ROOT / 'eye-apertures.png', 'data/eyes.png')
        z.write(ROOT / 'eye-cores.png', 'data/core.png')
        z.write(SOURCE, 'mergedimage.png')
    print(json.dumps({'width': W, 'height': H, 'duration': SECONDS, 'fps': FPS, 'bytes': mp4.stat().st_size, 'loop_base_difference': float(np.abs(np.asarray(selected[0], dtype=float) - np.asarray(selected[143], dtype=float)).mean())}))


if __name__ == '__main__':
    main()
