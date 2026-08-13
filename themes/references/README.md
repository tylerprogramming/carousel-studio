# Reference carousels

Real slides from the feed, cropped to the artboard, kept next to the themes so
the palette and the *treatment* live in the same place. A theme JSON is three
hex values; it cannot tell you that the body copy is monospace or that the
headline breaks across two lines. This file is that missing half.

Every hex here was sampled from these pixels, not eyeballed.
Full analysis and the performance data: `~/content/BRAIN/instagram/carousel-styles.md`.

```
electric/   @ibraviz.ai        01-cover, 02-what-this-is, 04-table-slide
pixel/      @albert.olgaard    01-numbered-cover, 03-mono-card, 08-cta-slide
copper/     @theromanknox      02-what-this-is, 03-why-it-works,
                               04-parts-gradient-table, 05-step-chips,
                               06-numbered-cards  + STRUCTURE.md
```

---

## Electric — `electric.json`

`#F7F8FA` ground · `#0A0A0A` ink · `#2454F0` accent

Reads like a spec sheet someone paid for. Use it when the point is that the
thing is **engineered**.

**Build it like this**

1. **Ground:** near-white with a faint `#F0F0F6` graph-paper grid. The grid is
   the whole "technical" signal - no other decoration is needed or wanted.
2. **Top rail, monospace, letterspaced:**
   `01 / 10 · TOPIC NAME · THE N-STEP BUILD` and `swipe →` on the right. The
   slide number sits in a rounded pill with a blue outline.
3. **Headline:** heavy grotesque, ALL CAPS, tight. **Two lines, two tones** -
   line 1 ink, line 2 accent blue. Keep the full stop: `WHAT / THIS IS.`
4. **One script aside** in blue under the headline, commentary only, never
   information: *"by the last step, it runs your whole day →"*.
5. **Sticky note, top right:** pale blue, tape strip, handwritten. One sentence
   that stands alone if the reader skims everything else.
6. **Rows:** white rounded-square tile + line glyph, bold label, grey sub-line.
   Use the real brand mark where one exists.
7. **Proof block:** a genuine dark terminal or product screenshot with
   traffic-light dots. Non-negotiable - this is what separates showing from
   claiming.
8. **Footer rail, mono:** handle left · `STEP · STEP · STEP · REPEAT` centre
   with the live step in blue · slide number right.

**The rule that makes it work:** one accent colour, used only to mark the thing
that matters on that slide. Everything else is greyscale. The moment a second
colour appears it stops looking engineered.

## Pixel — `pixel.json`

`#F0EAE4` ground · `#140A14` ink · `#D85424` accent

Warm, scrappy, personable. Use it when the point is that a **person** made this.

**Read this before you use it:** the palette is within a few points of our
existing `cream` theme (`#F5F0EB` / `#E07355`). We already had these colours.
What we did not have is the treatment below. Swapping the hex achieves nothing.

**Build it like this**

1. **Ground:** warm cream over a heavily washed-out photo of a real desk. The
   photo is texture, not content - if you can read it, it is too strong.
2. **Headline:** very heavy **condensed** caps (Anton / Druk class), two lines,
   numbered: `3. FAMOUS / YOUTUBE EDITOR`. Line 2 orange, with a hand-drawn
   double-underline swoosh beneath it.
3. **Body:** **monospace, centred, exactly three short lines**, inside a white
   rounded card with a thick orange border. Mono as body copy is the signature
   of this style - it is what makes it feel typed rather than designed.
4. **Annotations:** black handwritten script with a curved arrow pointing at
   the object being described. One or two per slide.
5. **Mascot:** a pixel-art character holding a prop that matches the slide
   (clapperboard, camera, paint roller, trophy). Recurring, so it becomes the
   account's face.
6. **Footer:** `@handle` bottom-left with the IG glyph, `save for later` in
   script bottom-right. Asking for the save out loud, on every slide.
7. **Last slide is pure CTA:** the comment keyword, huge, plus a disarming line
   (*"100% free of course :)"*).

## Copper — `copper.json`

Five slides, and a **full layout breakdown in
[copper/STRUCTURE.md](copper/STRUCTURE.md)**. Read that rather than this
section if you are building something: it separates the palette from the
layout vocabulary, because the vocabulary is the valuable half and it is
palette-independent.

Eight elements electric does not have: gradient panels, label chips, pinned
cards with a red pushpin, hand-drawn circled markers, ghosted step watermarks,
2x2 numbered tint cards, semantically coloured status tiles, and a gradient
bottom bar.

The palette is the part to be careful with, and it is measured:

`#FAFAFA` ground · `#0A0A0A` ink · `#B47850` → `#D28C5A` **gradient** accent

Kept because it is evidence, not because it is good. @theromanknox ran
substantially the same carousel as @ibraviz.ai days apart - same slide order,
same four components, several identical sentences - and got 337 likes and 270
saves against 7,254 and 10.4K.

Reach explains most of that gap. What reach does not explain is saves-per-like:
**0.80 against 1.43**.

Measured, not guessed: on the emphasis block, where the ground colour is
printed on top of the accent, copper gives **3.0:1** contrast. Electric gives
**5.5:1**. The themes README warns about exactly this failure and it is the one
that is easy to miss, because the headline still looks fine while the emphasis
line quietly turns to mush at thumbnail size.

Before shipping any new theme, run the check:

```python
def lum(h):
    h = h.lstrip("#"); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

def ratio(a, b):
    l1, l2 = sorted([lum(a), lum(b)], reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)
```

Aim for 4.5:1 or better on `ratio(accentColor, bgColor)`. Current themes:
electric 5.5, pixel 3.4, copper 3.0 - and copper's real number is worse than
that, because it prints white on the dark end of its gradient: **3.7:1**.

---

## How these crops were made

Instagram screenshots carry a status bar, story rail, header and action row.
The slide is found by scanning for the longest run of rows whose left-edge
pixels are not pure white - IG chrome renders at exactly `(255,255,255)`, every
slide here has a tinted ground reading 248-252.

Two things that had to be fixed, in case this is repeated:

- A `> 246` white test called `#FCFCFC` white and returned a 28-pixel sliver.
  The threshold has to be strict: `min(r,g,b) < 254`.
- A patterned ground (copper) hits pure white on scattered rows at the left
  edge, splitting one run into fragments. Sample a strip of columns rather than
  one, and merge runs separated by less than ~40px.

All seven crops land at a 1.24-1.25 height:width ratio, which is Instagram's
4:5 - a good sign the detection found the real artboard rather than a
coincidence.
