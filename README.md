# Marisol Bay — An Open-World Crime Story

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/0xberuuu/sunset-city-game/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/0xberuuu/sunset-city-game/reward.svg)](https://make.fun/c/gta6-01)

An entry for the [Make GTA 6 bounty](https://make.fun/c/gta6-01) on make.fun.

**Marisol Bay** is a complete top-down open-world crime game that runs entirely
from static files — no network requests, no libraries, no build step. Rosa
Vega, an ex-getaway driver, comes home to a sun-soaked coastal city to find
her brother Tomas in debt to Marcus Kane, the man who owns the docks. Five
story missions take her from a beach-bar pickup to a warehouse showdown, and
the whole city stays open for free roam afterwards.

## The city

A seeded grid city of avenues, streets, parks, a beach and a working harbor:
downtown towers with helipads, a palm-lined promenade, the Rusty Pelican beach
bar, the marina, and Kane's warehouse district. Traffic follows the road grid,
pedestrians stroll the sidewalks and flee from gunfire, and the sea shimmers
along the south shore.

## What is in the game

- **Explore on foot and by car** — walk, sprint, steal any parked or driven
  car (the owner notices), and drive with drift-friendly arcade handling,
  handbrake slides, skid marks and damage smoke.
- **Wanted level** — crimes raise heat from 0 to 5 stars. Police cruisers
  pursue and ram; foot officers try to arrest Rosa. Break line of sight to
  evade and watch the stars fade.
- **Missions and a story** — five jobs with dialogue, markers, a companion
  who rides along, a timed getaway, and a final assault on Kane himself.
- **Combat** — fists, pistol and unlockable SMG, mouse aim, enemy gunmen who
  seek, strafe and shoot back, plus health, armor and ammo pickups.
- **HUD with a minimap** — live map with mission and police blips, wanted
  stars, health, cash, weapon, speedometer and objective tracker.
- **Start screen, pause menu, help and saving** — autosaves after every
  mission, manual saves at the safehouse or from the pause menu.
- **Synthesized sound** — engine hum, sirens, gunshots and a procedural music
  loop, all generated with the WebAudio API. No audio files.

## Controls

| Keys | Action |
| ---- | ------ |
| WASD / Arrows | Move on foot, drive a car |
| Mouse | Aim, click to shoot (hold for SMG) |
| E | Enter / exit a car, talk, advance dialogue |
| Q | Switch weapon |
| F | Punch |
| Shift | Sprint |
| Space | Handbrake |
| Esc / P | Pause |
| M | Mute |

## Play it

Serve `game/` with any static file server and open `index.html` in desktop
Chrome, or run `node serve.ts` from this repository and open
http://localhost:8080.

Everything in the game — the city, the characters, the vehicles, the story,
the art and the music — is original work made for this entry. Nothing is taken
from any commercial game.

## Layout

- `game/index.html` — the page; loads the game as ES modules.
- `game/src/` — the game's own source, one job per file: `city.js` builds
  Marisol Bay, `vehicles.js` drives the cars, `traffic.js` runs traffic and
  pedestrians, `police.js` runs the wanted system, `combat.js` runs shooting
  and enemies, `missions.js` runs the story, `player.js` runs Rosa, `hud.js`
  draws the HUD and menus, `render.js` paints the world, `audio.js`
  synthesizes every sound, `effects.js` runs particles and skid marks,
  `save.js` saves progress, `shots.js` stages the screenshots, `main.js`
  boots the loop.
- `screenshots/` — four real renders of the game in a browser.
- `main.ts` — hands `game/` and `screenshots/` in with a `dossier.json`.
