"""The screen funnel — what the weekly screen throws away.

An asset, not a film. It renders to a TRANSPARENT clip that Remotion composites
over the house background, so nothing here draws a backdrop, a logo, a tagline
or an address: the header that carries all of that belongs to the Remotion
layer and is already on every frame.

White-label applies to every character that reaches the screen. The public
vocabulary is scout / fundamentals / macro / consensus / compile / verify, and
`marketing/video/scripts/check-leak.ts` now walks this directory and matches
`.py` so a caption here cannot bypass that gate.

Numbers are the real ones from the live screen and are passed in rather than
typed, for the same reason the chart films read theirs from a frozen dataset:
a figure typed into a scene is a figure nothing checks.
"""

from manim import (
    DOWN,
    UP,
    Create,
    FadeIn,
    Scene,
    Text,
    VGroup,
    Write,
    config,
    rate_functions,
)
from manim import Rectangle, ValueTracker, always_redraw
import numpy as np

# Portrait, matching the chart films so the two can share a timeline.
config.pixel_width = 1080
config.pixel_height = 1920
config.frame_width = 9.0
config.frame_height = 16.0
config.background_color = "#0B0E14"

INK = "#E8EAF0"
MUTED = "#9AA3B5"
GOLD = "#D4A24C"

# Read off the live screen, 2026-W32. Passed as data rather than prose so the
# scene cannot drift from the funnel the site publishes.
STAGES = [
    (7106, "US listings"),
    (2030, "clear the screen"),
    (300, "reach the pool"),
    (8, "the scout brings back"),
]


class Funnel(Scene):
    """Four bars, each a fraction of the one above, counting as they land."""

    def construct(self) -> None:
        title = Text("Every week, this much is thrown away", font_size=34, color=MUTED)
        title.to_edge(UP, buff=1.1)
        self.play(FadeIn(title, shift=DOWN * 0.2), run_time=0.8)

        widest = 7.2
        top = 4.6
        gap = 2.35
        rows = VGroup()

        for i, (value, label) in enumerate(STAGES):
            # Width is proportional to the SQUARE ROOT of the count, not to the
            # count. At a 7106-to-8 range a linear width makes the last bar
            # 0.008 of the first — a hairline that reads as nothing at all,
            # which understates the one row the whole screen exists to produce.
            frac = np.sqrt(value / STAGES[0][0])
            width = max(0.55, widest * frac)
            is_last = i == len(STAGES) - 1
            colour = GOLD if is_last else INK

            bar = Rectangle(
                width=width,
                height=0.9,
                stroke_color=colour,
                stroke_width=2.5,
                fill_color=colour,
                fill_opacity=0.10 if not is_last else 0.22,
            )
            bar.move_to([0, top - i * gap, 0])

            tracker = ValueTracker(0)
            count = always_redraw(
                lambda t=tracker, c=colour, b=bar: Text(
                    f"{int(t.get_value()):,}",
                    font_size=52 if b.width > 2 else 44,
                    color=c,
                ).next_to(b, UP, buff=0.22)
            )
            caption = Text(label, font_size=27, color=MUTED).next_to(bar, DOWN, buff=0.22)

            self.play(Create(bar), FadeIn(count), run_time=0.45)
            self.play(
                tracker.animate.set_value(value),
                rate_func=rate_functions.ease_out_cubic,
                run_time=0.9,
            )
            self.play(Write(caption), run_time=0.35)
            rows.add(bar, count, caption)

        self.wait(1.2)
