# claudethemes

Themes for Claude Code, packaged as mods.

## Day at office (`day-at-office`)

A backdrop for the Claude desktop and phone apps: Mumbai seen from a high office window, following the time of day and live weather of a city you choose (Mumbai by default). The city is a vector tracing of a photograph of that view (a theme backdrop takes drawings, not pictures), so it keeps the photo's real colours, buildings, metro line and glass reflections.

- **Clock:** the city's local time with AM or PM in a serif face at the top of the glass tower, over a translucent shade, with tokens used and left beneath it.
- **Day and night:** a blue haze by day, warm dawn and dusk, and at night a darker city with a faint warm glow at the horizon. Nothing in the scene flickers.
- **Context gauge:** a vertical bar on the glass tower on the right, under the clock, drawn as twenty floors that light up from the ground as the context window fills, with the percentage beside it and tokens used, tokens left and stars remaining beneath. It turns orange past 65% used and red past 85%.
- **Sun and moon:** the sun rises from behind the buildings on the left at the city's real sunrise, crosses the sky and sets behind them on the right at sunset; the full moon then rises on the left and sets at dawn. Times are worked out for the chosen city and date.
- **Live weather and season:** the sky shows the chosen city's current weather from [Open-Meteo](https://open-meteo.com) (free, no key), refreshed every 20 minutes: clear, partly cloudy, overcast, fog, drizzle, rain, snow or thunderstorm. The clock panel shows the temperature, conditions and season (wet or dry in the tropics, the four seasons elsewhere, flipped south of the equator).
- **Choose a city:** open `/config` and set **day-at-office › City**, such as `London` or `Paris, France`. The clock, sunrise, sunset, season and weather follow it; the skyline stays the Mumbai office view. Offline, or for a name that isn't found, it follows Mumbai with fair weather.
- **Stars:** 160 with an empty context window, going out one by one as it fills.
- **Message cards:** Claude's replies sit on midnight-blue invitation cards with a gold hairline frame and corner sparkles; your messages on golden tickets with cut corners, tilted a touch. App versions that don't support styled messages get a frosted column instead.

In a terminal there is no backdrop; the status line shows the time, usage and stars instead. The view draws once a desktop or phone app is showing a session that runs on your own computer.

### Install

At the prompt of a Claude Code session in a terminal:

```
/plugin install day-at-office --marketplace deployproai/claudethemes
```

Answer `y` to add the marketplace, then pick a scope. Open a session in the Claude desktop app to see the sky.

### Notes

- Built and checked against Claude Code 2.1.332. Mods are an early-access feature and may change between releases.
- The sky has only been checked as rendered outside the app; look at it in both the desktop and phone apps.
- On a tall phone screen the sky is cropped to its centre, so the sun or moon is fully in view around midday and midnight. The clock is always visible.
