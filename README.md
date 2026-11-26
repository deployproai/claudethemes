# claudethemes

Themes for Claude Code, packaged as mods.

## New Year sky (`new-year-sky`)

A backdrop for the Claude desktop and phone apps: a New Year sky over a New York skyline, following the time of day in India (IST).

- **Clock:** the time in IST with AM or PM in the top-right corner, with tokens used, tokens left and stars remaining beneath it.
- **New Year:** "Happy New Year 2027" in the top-left corner, a ball-drop tower with a glowing 2027 sign, fireworks and falling confetti.
- **Skyline:** Manhattan-style towers along the bottom, windows lit at night.
- **Day and night:** night blue after dark, warm dawn and dusk, blue sky with clouds by day.
- **Sun and moon:** the sun is up from 6 AM to 6 PM IST and the moon from 6 PM to 6 AM. Each climbs the left side, crosses the middle around noon or midnight and sets down the right side, so the chat column doesn't hide it. It carries the context figures, and warms to amber past 65% used and to ember past 85%.
- **Stars:** 160 with an empty context window, going out one by one as it fills.

- **Message cards:** your messages and Claude's replies sit on their own rounded cards over an almost clear chat column, so the sky shows all around the words. App versions that don't support styled messages get a frosted column instead.

In a terminal there is no backdrop; the status line shows the time, usage and stars instead. The sky draws once a desktop or phone app is showing the session.

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
