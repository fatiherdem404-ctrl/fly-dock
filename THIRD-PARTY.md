# Third-party material

Fly Dock itself is GPL-3.0-only (see [LICENSE](LICENSE) and [NOTICE](NOTICE)). It uses the following work by others.
Their licences apply to them, not to Fly Dock's own code.

## Icon libraries (icon studio)

The glyph pickers in the icon studio and the built-in default icon pack draw on these sets. The glyph data is generated
into `src/studio/` by `scripts/make-studio-glyphs.mjs` and `scripts/make-studio-libs.mjs`.

| Library | Licence | Source |
| --- | --- | --- |
| Lucide | ISC | https://lucide.dev |
| Tabler Icons | MIT | https://tabler.io/icons |
| Font Awesome Free (icons) | CC BY 4.0 | https://fontawesome.com/license/free |

Font Awesome Free icons are by Fonticons, Inc. and licensed under Creative Commons Attribution 4.0
(https://creativecommons.org/licenses/by/4.0/). Changes: the icons are scaled into a 24 x 24 box and recoloured.
The Font Awesome Free code and fonts (SIL OFL 1.1 / MIT) are not shipped.

Lucide — ISC License. Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT);
all other copyright (c) for Lucide are held by Lucide Contributors 2022.

Tabler Icons — MIT License. Copyright (c) 2020-2024 Pawel Kuna.

## Runtime and build tools

| Package | Licence |
| --- | --- |
| Electron | MIT |
| electron-store | MIT |
| React, React DOM | MIT |
| Vite and its plugins | MIT |
| TypeScript | Apache-2.0 |
| electron-builder | MIT |

Exact versions are in `package-lock.json`.

## Artwork

The cursor pack, wallpaper scenes, textures and concept images were made for this project with AI assistance and edited
by the author.
