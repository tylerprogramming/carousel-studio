# Copper — the structure

@theromanknox, five slides, sampled 2026-08-13.

**Read this as two separate things.** The palette below is one option. The
layout vocabulary underneath it is the valuable part, and it is
palette-independent — every element here works in electric blue, and probably
works better, for the reason in the contrast note at the bottom.

## Palette (sampled across all five slides)

| Role | Hex |
|---|---|
| Ground | `#FAFAFA` warm near-white, over a faint hexagon/cube pattern |
| Ink | `#0A0A0A`, with `#282828` for secondary |
| Accent | **a gradient**, `#B47850` → `#D28C5A` |
| Tint | `#F5DCC8` pale tan, for the soft cards |

The accent being a *gradient rather than a flat colour* is the single biggest
palette difference from electric. Every filled surface — the icon tiles, the
table, the bottom bar, the vault card — is a two-stop copper ramp, always dark
at top-left and light at bottom-right.

## The layout vocabulary

Eight elements, none of which electric has. This is what to steal.

**1. Gradient panel.** A large rounded block filled with the accent ramp,
white text inside. Used for the four-parts table (slide 4) and the Vault card
(slide 6). Where electric uses a white card with a thin accent border, this
fills the whole block. It is louder and it anchors the slide.

**2. Label chip.** A small dark rounded chip with white text, sitting on top of
a pale tint card — `What it is:` / `Your first five skills:` / `The rule:`
(slide 5). This is how a slide gets three labelled sections without three
headings, and it is the most reusable element here.

**3. Pinned card.** A white card with a drawn **red pushpin** at the top-right
corner and a heavy shadow. Same job as electric's taped sticky note, different
metaphor. Carries the thesis: `IF IT'S NOT IN THE VAULT, IT DIDN'T HAPPEN.`

**4. Circled marker.** A hand-drawn ellipse in accent, looping around a phrase —
`That's all.` / `Do this now — it compounds.` / `Strong skills come from real
workflows.` It reads as someone circling a line on a printout. Electric's
equivalent is the underline rule, which is quieter.

**5. Ghosted step watermark.** `Step 1:` set huge and pale *behind* the real
headline, half cropped by the top edge (slides 5, 6). Cheap, and it makes a
sequence obvious at a glance without spending a line on it.

**6. Numbered tint cards.** Four pale cards in a 2×2, each with a big ghosted
numeral (`01`–`04`) behind short text (slide 6). Good for four peers with no
order dependency, where a table would imply hierarchy.

**7. Status tiles.** The icon tile takes a *semantic* colour rather than the
brand one: red for the old way, green for the new way, accent for the loop
(slide 3). Electric keeps every tile neutral. This is more legible at a glance
and worth adopting.

**8. Gradient bottom bar.** A full-width accent ramp holding four white tiles
with icons and labels — `Speak. Route. Execute. Remember.` (slide 2). Same job
as electric's white quad card, inverted.

Plus a **3D mascot** (Obsidian gem + blocky character) parked top-right on every
slide, and a **two-column footer** (`Social media @handle | Build Skills
skool.com/knox`) with a page pill and a `swipe ←` pill.

## Type

Title Case, not caps. A gradient fill on the headline itself, dark on the left
running to tan on the right. Heavier and rounder than electric's grotesque.
Body is a bold sans with coloured lead-ins (`Old way:` in red, `New way:` in
green, `The Loop:` in copper).

## The contrast problem, measured

This is why the style is recorded as the control case rather than recommended:

```
text on ground          19.0:1   fine
ground on accent mid     3.0:1   fails (needs 4.5)
white on accent dark     3.7:1   fails, and this is how they actually use it
```

White text on the copper gradient is **3.7:1**. The four-parts table and the
bottom bar both do exactly that, so the slide's two loudest elements are its
least legible ones at thumbnail size. Electric's accent block measures 5.5:1.

That is the concrete case for what Tyler asked about: **take this structure,
keep the electric palette.** Gradient panels, label chips, pinned cards,
circled markers, ghosted step numerals and numbered tint cards all work in
`#2454F0` — and in blue they would pass the contrast check that copper fails.

## Files

```
02-what-this-is.png          icon tiles + gradient bottom bar
03-why-it-works.png          status tiles (red/green/accent) + product shot
04-parts-gradient-table.png  gradient panel table, pinned card, circled marker
05-step-chips.png            ghosted step watermark, label chips, tint cards
06-numbered-cards.png        gradient vault card, 2x2 numbered tint cards
```
