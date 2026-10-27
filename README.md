<!-- Generated from docs/templates/README.md.tpl and src/config/brand.config.json by `npm run brand:render`. Do not edit by hand. -->
# Fly Dock

A modern dock for your desktop — An open-source Windows dock inspired by RocketDock: widgets, themes and icon packs.

[Türkçe](README.tr.md) · [Issues](https://github.com/PLACEHOLDER/fly-dock/issues) · [Support on Ko-fi](https://ko-fi.com/PLACEHOLDER)

> Status: early development (Phase 0). Not ready for daily use yet.

![Screenshot placeholder](docs/screenshot.png)

## Features

Working today (skeleton):

- Transparent, always-on-top dock window (bottom/top/left/right)
- Hover magnification with a cosine falloff
- Running-app indicators (polling via PowerShell for now)
- Automatic `.exe` icon extraction with disk cache and manual override
- Persistent config (`electron-store`)

Planned: drag & drop, settings window, auto-hide, multi-monitor, widgets, JSON themes, icon packs, wallpapers, sound packs. See [ROADMAP.md](ROADMAP.md).

## Getting started

Requires Node.js and Windows 10/11. No native build tools needed.

```bash
npm install
npm run dev
```

Useful scripts: `npm run typecheck`, `npm run brand:check`, `npm run brand:render`, `npm run build`.

## Architecture

```
electron/   main process: dock window, tray, IPC, store, windowManager (PowerShell + user32.dll),
            iconExtractor (PowerShell + System.Drawing). A C# helper process will replace the
            PowerShell calls (see ROADMAP.md, item 0.2).
src/        renderer (React): Dock, DockIcon, Separator, styles
src/config/brand.config.json   single source for name, ids, links and logo paths
scripts/    brand check and docs rendering
```

Name, app id, links, tray text, window title, installer name and these docs all come from `src/config/brand.config.json`. Change it there, run `npm run brand:render`, and `npm run brand:check` will tell you if anything else is hardcoded.

## Support the project

Fly Dock is free and open source. If it is useful to you, you can support development on [Ko-fi](https://ko-fi.com/PLACEHOLDER).

## License

GPL-3.0-only — see [LICENSE](LICENSE). Copyright © 2026 Fatih Erdem.
