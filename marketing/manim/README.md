# marketing/manim — mechanism animations, as assets

ManimCE renders the things Remotion is bad at. It is **not a second video pipeline**: nothing here
produces a film. Each scene renders to a sequence of transparent frames that a Remotion composition
composites over the house background, so the header, the brand row, the score and the cut all stay
where they already are.

## What it is for

Remotion owns motion, layout and the racing-line chart format. Manim owns *explaining a mechanism* —
the cases where the picture IS the argument:

- the screen funnel: 7,106 listings → 2,030 eligible → 300 in the pool → 8 delivered
- the three lenses drawn as an actual set intersection, with the confluence as the middle
- a discounted cash-flow stream shrinking toward its present value
- a game-theory tree with probabilities on the branches
- conditional base rates drawn on the distribution they were drawn from

If a beat is text, chips and timing, it belongs in Remotion. If a beat only works because a shape
moves into another shape, it belongs here.

## Setup

```
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

Python 3.13 and ffmpeg are the only prerequisites. **LaTeX is not needed** — the scenes use `Text()`,
which renders through Pango. Only `Tex()`/`MathTex()` would require a TeX installation, and nothing
here uses them.

## Rendering

```
.venv/Scripts/python.exe render.py Funnel
.venv/Scripts/python.exe render.py Funnel --quality l     # draft, 15fps
```

Frames land in `../video/public/manim/<Scene>/` with a `manifest.json` giving the frame count, fps
and duration, so the Remotion side reads those rather than guessing them.

## The transparency trap

**Two of the three obvious routes fail silently.** They accept the transparency flag, print no
warning, and write a file whose corner pixel is the opaque background colour — which composites as a
solid rectangle over whatever it was meant to sit on. All three were measured:

| Route | Result |
|---|---|
| `manim -t --format=webm` | `pix_fmt=yuv420p`, corner alpha **255**. No alpha channel at all. |
| `manim -t --format=mov` | `pix_fmt=argb`, corner alpha 0. Real alpha — but qtrle, which no browser decodes, so Remotion cannot use it either. |
| MOV → VP9 or VP8 WebM | Both encoders **list** `yuva420p` as supported and both write `yuv420p` anyway, with an explicit `-vf format=yuva420p` and `-auto-alt-ref 0`. WebM alpha lives in a BlockAdditions track this ffmpeg build does not write. |
| `manim -t --format=png` | `pix_fmt=rgba`, corner alpha 0, content alpha real. ~12 MB for 233 frames at 1080×1920. |

So: PNG frames. `render.py` verifies rather than assumes — it checks the pixel format, checks the
corner alpha on **three** frames rather than one (an empty opening frame is transparent whatever went
wrong), and then checks that something was actually drawn, because a scene that rendered nothing
passes a transparency check trivially.

## Rules

- **Everything on screen is white-label.** `marketing/video/scripts/check-leak.ts` now walks this
  directory and matches `.py`, so a caption here cannot bypass the gate — proved by injection. Public
  vocabulary only: scout / fundamentals / macro / consensus / compile / verify.
- **No typed figures.** A number on screen comes from the data the site publishes, passed into the
  scene as data. A figure typed into a scene is a figure nothing checks — the same rule the chart
  films run on.
- **No backdrop, no logo, no tagline, no address.** Those belong to the Remotion layer and are
  already on every frame. A scene that draws its own background defeats the whole arrangement.
- **`marketing/video/FORMULA.md` outranks anything here**, as it does every other part of the video
  line. Type floors, contrast rules and safe zones apply to a manim frame exactly as to a Remotion
  one.
- Frames are **gitignored** — regenerable from the scene file, and hundreds of PNGs per scene.
