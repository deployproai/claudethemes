# claudethemes

Themes for Claude Code, packaged as mods.

## New Year sky (`new-year-sky`)

A backdrop for the Claude desktop and phone apps that follows the time of day in India (IST).

- **Clock:** the current time in IST with AM or PM at the top centre, with tokens used, tokens left and stars remaining beneath it.
- **Day and night:** night blue after dark, warm dawn and dusk, blue sky with drifting clouds by day.
- **Sun and moon:** the sun is up from 6 AM to 6 PM IST and the moon from 6 PM to 6 AM. Each rises on the left, arcs over and sets on the right, and carries the context figures.
- **Stars:** 160 with an empty context window, going out one by one as it fills. The sun or moon warms to amber past 65% used and to ember past 85%.
- **Night extras:** slow golden fireworks and a shooting star.

In a terminal there is no backdrop; the status line shows the time, usage and stars instead.

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
