# claudethemes

Themes for Claude Code, packaged as mods.

## New Year sky (`new-year-sky`)

A backdrop for the Claude desktop and phone apps: Mumbai seen from a high office window at New Year, following the time of day in India (IST). The scene is an original drawing based on the owner's own photograph.

- **The view:** a hazy sky over cream residential towers (one with a crane), trees, blue shed roofs, a construction plot and an elevated metro line with traffic beneath, with a glass tower down the right edge and the window frame and soft reflections on the left.
- **Clock:** the time in IST with AM or PM on an LED panel at the top of the glass tower, with tokens used and left beneath it.
- **New Year:** a "Happy New Year 2027" panel on the tower, and fireworks over the city.
- **Day and night:** blue haze by day, warm dawn and dusk, and at night the towers' windows light up.
- **Sun and moon:** the sun is up from 6 AM to 6 PM IST and the moon from 6 PM to 6 AM. Each rises out of the city in the left margin, peaks at noon or midnight and sinks back. It carries the context figures and the number of stars left, and warms to amber past 65% used and to ember past 85%.
- **Stars:** 160 with an empty context window, going out one by one as it fills.
- **Message cards:** Claude's replies sit on midnight-blue invitation cards with a gold hairline frame and corner sparkles; your messages on golden tickets with cut corners, tilted a touch; headings in gold italic serif. App versions that don't support styled messages get a frosted column instead.

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
