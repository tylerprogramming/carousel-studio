#!/usr/bin/env python3
"""
slides_to_video.py — turn a whole carousel into one short vertical video.

A TikTok photo carousel and a video are different formats with different
reach. This takes the slides you already have and plays them as a single
1080x1920 clip: cover, then each slide, then the close. Four to six seconds
total, which is enough to read a short line per slide and short enough to loop.

Slides are held for a fixed beat each, and the cover gets a longer hold since
it carries the hook and is what someone decides on.

Usage: python3 slides_to_video.py '<json payload>'

Payload:
  inputs     : list of image paths, in order                  (required)
  output     : where to write the mp4                         (required)
  perSlide   : seconds each slide is held. Total is derived.  (default 2.5)
  duration   : total seconds instead, split across slides.    (optional)
  coverBoost : the cover is held this much longer             (default 1.4)
  audio      : audio file laid under it                       (optional)
  fade       : cross-fade seconds between slides, 0 for cuts  (default 0)
"""

import json
import os
import subprocess
import sys
import tempfile

W, H, FPS = 1080, 1920, 30


def run(cmd):
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip()[-1500:])
    return proc


def slide_durations(count, cover_boost, per_slide=None, total=None):
    """Hold each slide for a fixed beat, cover a little longer.

    per_slide is the honest control: a reader needs a couple of seconds per
    slide, so the clip length should follow the slide count rather than the
    slides being squeezed into a fixed runtime.
    """
    weights = [cover_boost] + [1.0] * (count - 1) if count > 1 else [1.0]
    if per_slide is not None:
        return [w * per_slide for w in weights]
    unit = float(total) / sum(weights)
    return [w * unit for w in weights]


def build(cfg):
    inputs = [p for p in cfg['inputs'] if os.path.exists(p)]
    if not inputs:
        raise RuntimeError('no input images exist')
    out = cfg['output']
    fade = float(cfg.get('fade', 0) or 0)
    audio = cfg.get('audio') or ''
    cover_boost = float(cfg.get('coverBoost', 1.4))
    per_slide = cfg.get('perSlide')
    if per_slide is None and not cfg.get('duration'):
        per_slide = 2.5
    durations = slide_durations(
        len(inputs), cover_boost,
        per_slide=float(per_slide) if per_slide is not None else None,
        total=float(cfg['duration']) if per_slide is None else None,
    )
    total = sum(durations)

    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)

    if fade > 0 and len(inputs) > 1:
        # xfade chains pairwise, so each input must run long enough to overlap
        # with the next one. Built as one filter_complex rather than N temp files.
        cmd = ['ffmpeg', '-y', '-loglevel', 'error']
        for path, dur in zip(inputs, durations):
            cmd += ['-loop', '1', '-t', f'{dur + fade:.3f}', '-i', path]
        if audio:
            cmd += ['-i', audio]

        parts = [f'[{i}:v]scale={W}:{H}:force_original_aspect_ratio=increase,'
                 f'crop={W}:{H},setsar=1,fps={FPS}[v{i}]' for i in range(len(inputs))]
        prev, offset = 'v0', 0.0
        for i in range(1, len(inputs)):
            offset += durations[i - 1]
            label = f'x{i}'
            parts.append(f'[{prev}][v{i}]xfade=transition=fade:duration={fade}:offset={offset:.3f}[{label}]')
            prev = label
        filt = ';'.join(parts)
        cmd += ['-filter_complex', filt, '-map', f'[{prev}]']
    else:
        # Hard cuts. The concat demuxer is exact about per-image duration, which
        # matters when each slide is only about a second.
        with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False) as fh:
            for path, dur in zip(inputs, durations):
                fh.write(f"file '{os.path.abspath(path)}'\nduration {dur:.3f}\n")
            # concat needs the last file repeated or it drops the final frame
            fh.write(f"file '{os.path.abspath(inputs[-1])}'\n")
            list_path = fh.name
        cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list_path]
        if audio:
            cmd += ['-i', audio]
        cmd += ['-vf', f'scale={W}:{H}:force_original_aspect_ratio=increase,'
                       f'crop={W}:{H},setsar=1,fps={FPS}']

    if audio:
        fade_out = max(0.0, total - 0.6)
        cmd += ['-af', f'afade=t=in:st=0:d=0.3,afade=t=out:st={fade_out:.2f}:d=0.6',
                '-c:a', 'aac', '-b:a', '192k', '-shortest']
    else:
        cmd += ['-an']

    cmd += ['-t', f'{total}', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
    try:
        run(cmd)
    finally:
        if fade <= 0 or len(inputs) <= 1:
            try:
                os.unlink(list_path)
            except Exception:
                pass
    return out


def main():
    if len(sys.argv) < 2:
        print('usage: slides_to_video.py <json>', file=sys.stderr)
        sys.exit(1)
    cfg = json.loads(sys.argv[1])
    if not cfg.get('inputs') or not cfg.get('output'):
        print('missing required key: inputs and output', file=sys.stderr)
        sys.exit(1)
    try:
        print(build(cfg))
    except Exception as exc:
        print(f'slides_to_video failed: {exc}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
