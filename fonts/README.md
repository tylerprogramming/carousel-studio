# Fonts

Two faces are vendored, and both are loaded by the renderer *and* the browser
from these exact files. That is deliberate: a CSS font stack the exporter
cannot read, or a vendored file the browser never sees, would quietly break the
promise that the preview is a preview.

| | |
|---|---|
| `Inter-Variable.ttf` | Body text. Variable, weight axis 100–900. SIL OFL 1.1. |
| `JetBrainsMono-Regular.ttf` | The terminal variant's mono, and the fallback on any OS without Menlo. SIL OFL 1.1, licence alongside. |

## Using your own

Drop a `.ttf` or `.otf` in here and name it in `settings.json`:

```json
{
  "fontPath": "MyBrand-Variable.ttf",
  "monoFontPath": "MyBrand-Mono.ttf"
}
```

A bare filename means this folder. An absolute path or a `~` path is taken as
given. A font that does not exist falls back to the vendored one rather than
failing — a typo should not stop you rendering.

### What to expect

**Variable fonts** work properly: the design asks for weights from 400 to 800,
and those are set on the font's own weight axis. The axis is found by name, so
the order the font declares its axes in does not matter.

**Static fonts** work, but every weight comes out the same. The design still
asks for 800 on headlines; with a single-weight face there is nothing to ask.
If you want the weight contrast, supply a variable font or expect a flatter
look.

**Layout moves.** Text is measured in the face it will be drawn in, so a wider
font wraps sooner and the emphasis block grows to fit. That is correct — it is
the same measurement the exporter does — but a deck tuned to Inter may need its
`textScale` revisited. Run the checker; it measures with your font too.

**Goldens will fail**, if you run the tests with a font configured. The
reference renders are Inter. That is the provenance check doing its job — it
reports the font it was expecting.

### Licensing

Vendored fonts keep their own licence, which is why `JetBrainsMono-OFL.txt`
sits here. If you add a font to a fork you intend to share, check you are
allowed to redistribute it. Plenty of licences permit use but not bundling.
