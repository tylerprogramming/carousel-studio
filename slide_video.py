#!/usr/bin/env python3
"""
slide_video.py — turn one carousel slide into an MP4 at slide dimensions.

Instagram carousels accept video slides alongside image slides, so slide 1 can
move while the rest stay still. This composites:

    moving background  (a still, slowly pushed in, or a supplied clip)
  + the slide overlay  (generate_slide.py with transparent: true)
  + optional audio

and writes h264 at the slide's own size. That is 1080x1350 for a normal slide
and 1080x1920 for a `tall` one — the overlay is measured rather than assumed,
because scaling a 9:16 overlay into a 4:5 frame squashes it silently. Note this
is NOT flash_video.py, which targets 1080x1920 for standalone Reels.

Usage: python3 slide_video.py '<json payload>'

Payload:
  overlay   : PNG with alpha, from generate_slide.py `transparent`
              (omit for a background-only clip the editor plays under text)
  source    : still image or video to sit underneath                 (optional)
  audio     : audio file to lay under it                             (optional)
  duration  : seconds, default 5
  zoom      : total push-in over the clip, default 1.08 (1.0 = none)
  output    : where to write the mp4                                 (required)
"""

import json
import os
import subprocess
import sys

W, H, FPS = 1080, 1350, 30
VIDEO_EXT = {'.mp4', '.mov', '.m4v', '.webm', '.mkv'}


def canvas_for(overlay: str):
    """Frame size, taken from the overlay rather than assumed.

    A `tall` slide's overlay is 1080x1920. Scaling that to a fixed 1080x1350
    would squash it, and nothing downstream would say so — the clip just comes
    out wrong. With no overlay there is nothing to measure, so the 4:5 default
    stands.
    """
    if overlay and os.path.exists(overlay):
        try:
            from PIL import Image
            with Image.open(overlay) as im:
                return im.size
        except Exception:
            pass
    return W, H


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip()[-1500:])
    return p


def build(cfg):
    overlay = cfg.get('overlay') or ''
    source = cfg.get('source') or ''
    audio = cfg.get('audio') or ''
    dur = float(cfg.get('duration', 5))
    zoom = float(cfg.get('zoom', 1.08))
    out = cfg['output']
    frames = max(1, int(round(dur * FPS)))
    w, h = canvas_for(overlay)

    is_video = os.path.splitext(source)[1].lower() in VIDEO_EXT if source else False

    cmd = ['ffmpeg', '-y', '-loglevel', 'error']
    if source and is_video:
        cmd += ['-i', source]
    elif source:
        cmd += ['-loop', '1', '-t', f'{dur}', '-i', source]
    else:
        # No source: a flat colour bed, so the overlay still becomes a video
        cmd += ['-f', 'lavfi', '-t', f'{dur}', '-i', f'color=c=black:s={w}x{h}:r={FPS}']
    if overlay:
        cmd += ['-i', overlay]
    if audio:
        cmd += ['-i', audio]

    if source and not is_video and zoom > 1.0:
        # Ken Burns. zoompan samples per output frame, so it is fed a large
        # scaled still and asked for `frames` outputs at slide size. The 1e-4
        # step is derived from the total zoom so the push is linear-ish.
        step = (zoom - 1.0) / frames
        bg = (
            f"scale={w*4}:{h*4}:force_original_aspect_ratio=increase,"
            f"crop={w*4}:{h*4},"
            f"zoompan=z='min(zoom+{step:.6f},{zoom})':d={frames}"
            f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={w}x{h}:fps={FPS}"
        )
    else:
        bg = (
            f"scale={w}:{h}:force_original_aspect_ratio=increase,"
            f"crop={w}:{h},fps={FPS}"
        )

    if overlay:
        fc = f"[0:v]{bg}[bg];[1:v]scale={w}:{h}[ov];[bg][ov]overlay=0:0:format=auto[v]"
    else:
        fc = f"[0:v]{bg}[v]"
    cmd += ['-filter_complex', fc, '-map', '[v]']

    if audio:
        # Fade the tail so a hard cut on a 5 second clip is not jarring
        fade_out = max(0.0, dur - 0.6)
        cmd += ['-af',
                f'afade=t=in:st=0:d=0.3,afade=t=out:st={fade_out:.2f}:d=0.6']
        cmd += ['-map', f'{2 if overlay else 1}:a', '-c:a', 'aac', '-b:a', '192k']
    else:
        cmd += ['-an']

    cmd += ['-t', f'{dur}', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
    run(cmd)
    return out


def main():
    if len(sys.argv) < 2:
        print('usage: slide_video.py <json>', file=sys.stderr)
        sys.exit(1)
    cfg = json.loads(sys.argv[1])
    if not cfg.get('output'):
        print('missing required key: output', file=sys.stderr)
        sys.exit(1)
    os.makedirs(os.path.dirname(cfg['output']) or '.', exist_ok=True)
    try:
        print(build(cfg))
    except Exception as e:
        print(f'slide_video failed: {e}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
