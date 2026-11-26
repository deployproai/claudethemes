# claudethemes

Themes for Claude Code, packaged as mods.

## New Year sky (`new-year-sky`)

A backdrop for the Claude desktop and phone apps: Mumbai seen from a high office window at New Year, following the time of day in India (IST). The city is a vector tracing of a photograph of that view (a theme backdrop takes drawings, not pictures), so it keeps the photo's real colours, buildings, metro line and glass reflections.

- **Clock:** the time in IST with AM or PM on an LED panel at the top of the glass tower, with tokens used and left beneath it.
- **New Year:** a "Happy New Year 2027" panel on the tower.
- **Day and night:** a blue haze by day, warm dawn and dusk, and at night a darker city with a faint warm glow at the horizon. Nothing in the scene flickers.
- **Context gauge:** a vertical bar on the left edge, drawn as twenty floors that light up from the ground as the context window fills, with the percentage beside it and tokens used, tokens left and stars remaining beneath. It turns orange past 65% used and red past 85%.
- **Sun and moon:** from 6 AM to 6 PM IST a white sun with a starburst of rays and lens flares crosses a blue sky of clouds; from 6 PM to 6 AM a full blue-white moon is up in a deep blue night. Each rises above the skyline beside the gauge and sinks back. They are round at a typical laptop window shape and slightly oval on very wide or tall windows, because the backdrop stretches with the window.
- **Stars:** 160 with an empty context window, going out one by one as it fills.
- **Message cards:** Claude's replies sit on midnight-blue invitation cards with a gold hairline frame and corner sparkles; your messages on golden tickets with cut corners, tilted a touch. App versions that don't support styled messages get a frosted column instead.

In a terminal there is no backdrop; the status line shows the time, usage and stars instead. The view draws once a desktop or phone app is showing a session that runs on your own computer.

### Install

At the prompt of a Claude Code session in a terminal:

```
/plugin install new-year-sky --marketplace deployproai/claudethemes
```

Answer `y` to add the marketplace, then pick a scope. Open a session in the Claude desktop app to see the sky.

### Notes

- Built and checked against Claude Code 2.1.332. Mods are an early-access feature and may change between releases.
- The sky has only been checked as rendered outside the app; look at it in both the desktop and phone apps.
- On a tall phone screen the sky is cropped to its centre, so the sun or moon is fully in view around midday and midnight. The clock is always visible.
