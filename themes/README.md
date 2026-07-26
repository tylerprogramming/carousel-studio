# Themes

A theme is the palette a slide is built from. Every `.json` file in this folder
shows up as a swatch in the editor. To add one, drop a file in here and reload
the app. There is nothing to rebuild and no code to change.

## The format

```json
{
  "id": "terminal",
  "name": "Terminal",
  "description": "Dark mono look with a terminal window block.",
  "bgColor": "#12141A",
  "textColor": "#EEECE8",
  "accentColor": "#E07355",
  "variant": "terminal",
  "order": 6
}
```

| Field | Required | What it does |
|---|---|---|
| `bgColor` | yes | Slide background. |
| `textColor` | yes | Headlines and body copy. |
| `accentColor` | yes | Emphasis blocks, step numbers, the `swipe →` marker. |
| `name` | no | Shown on hover. Falls back to the filename. |
| `id` | no | Falls back to the filename. |
| `description` | no | For your own reference. Not rendered. |
| `variant` | no | `default`, `terminal` or `tall`. See below. |
| `order` | no | Sort position in the swatch row. Unset sorts last. |

A file missing any of the three colours is skipped, and a file with broken JSON
is skipped on its own without hiding the others.

## Picking colours

The three colours are used together, so check them as a set:

- `textColor` on `bgColor` needs real contrast. This is the one that decides
  whether the slide is readable at thumbnail size on a phone.
- `accentColor` is a **background** for the emphasis block, with `bgColor`
  printed on top of it. So accent and background need contrast too. A dark
  accent on a dark background gives you an unreadable emphasis line, which is
  easy to miss when you are only looking at the headline.
- Accent is also used for thin marks like `swipe →`. Very light accents
  disappear against a light background.

## `variant` is a layout, not just a palette

Most themes only change colours. `variant: "terminal"` also changes how the
slide is drawn: mono type, a rail across the top, and a terminal window block
instead of a body paragraph. Slides using it read `terminalLines` and
`terminalTitle`.

`variant: "tall"` is that same layout on a 1080x1920 canvas instead of
1080x1350. It exists for TikTok: a 4:5 slide has to be scaled down and padded
to fit a 9:16 frame, which leaves about 44% of the post as empty margin. A tall
slide is drawn at 9:16 from the start, with its text laid out clear of TikTok's
caption block, action rail and tab chrome, so it needs no reframing at all.
Everything else — colours, type, the terminal window — is identical.

Use it when the carousel is going to TikTok. Note the text column is narrower
(it stops short of the action rail), so a headline that fit at 4:5 may not fit
here; the pre-export check measures against whichever canvas the slide uses.

If you are making a colour theme, leave `variant` out.

## Saving from the editor

The `+` button in the theme row saves whatever colours the current slide uses.
Those are stored in your browser's localStorage, not here, because they belong
to you rather than to the app. To make one permanent, or to share it, copy the
values into a file in this folder.

## Renderer parity

Colours are passed straight through to both renderers, so nothing here needs to
be kept in sync by hand. Layout changes are different: `generate_slide.py` and
`client/src/components/SlidePreview.tsx` are deliberate twins, and a new
`variant` means editing both.
