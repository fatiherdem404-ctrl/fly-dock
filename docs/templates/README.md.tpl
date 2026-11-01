<!-- Generated from docs/templates/README.md.tpl and src/config/brand.config.json by `npm run brand:render`. Do not edit by hand. -->
# {{name}}

{{tagline.en}} — {{description.en}}

[Türkçe](README.tr.md) · [Issues]({{issuesUrl}})

> Status: early development (Phase 0). Not ready for daily use yet.

![Screenshot placeholder](docs/screenshot.png)

## Features

Working today (skeleton):

- Transparent, always-on-top dock window per monitor (bottom/top/left/right), auto-hide, hides over fullscreen apps
- Spring-physics magnification, drag & drop to add, reorder and remove, recycle bin
- Running-app indicators driven by window events from a C# helper process
- Sharp shell icons (up to 256px), icon packs and manual overrides
- Folder stacks, global shortcuts, multi-monitor, Win11 acrylic/mica
- Desktop widgets: clock, weather, CPU/RAM/disk, media keys, calendar
- JSON themes and icon packs (`.flypack`, import/export, validated)
- Settings window with live preview, 10 desk styles, animation library, backup and restore

Planned: wallpapers, live backgrounds, sound packs, community pack sharing. See [ROADMAP.md](ROADMAP.md).

## Getting started

Requires Node.js, the .NET 10 SDK (builds the helper process) and Windows 10/11.

```bash
npm install
npm run dev
```

Useful scripts: `npm run typecheck`, `npm run brand:check`, `npm run brand:render`, `npm run build`.

## Architecture

```
helper/     C# helper process: window events, shell icons, recycle bin (JSON over stdin/stdout)
electron/   main process: dock windows, tray, typed IPC, store, packs, widgets
src/        renderer (React): dock, settings, stack and widget views; src/shared holds the IPC contract
src/config/brand.config.json   single source for name, ids, links and logo paths
scripts/    brand check and docs rendering
```

Name, app id, links, tray text, window title, installer name and these docs all come from `src/config/brand.config.json`. Change it there, run `npm run brand:render`, and `npm run brand:check` will tell you if anything else is hardcoded.


## License

{{license}} — see [LICENSE](LICENSE). Copyright © {{copyrightYear}} {{company}}.

The code is free to use and change. The name "{{name}}" and the logo are not part of the licence: they mark the official release. If you publish a changed version, give it another name and logo, keep the copyright notices and say that it is modified — details in [NOTICE](NOTICE).

Third-party licences: [THIRD-PARTY.md](THIRD-PARTY.md).
