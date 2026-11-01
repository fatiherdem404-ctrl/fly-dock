// Everything name-related comes from src/config/brand.config.json.
const brand = require('./src/config/brand.config.json')

module.exports = {
  appId: brand.appId,
  productName: brand.name,
  copyright: `Copyright © ${brand.copyrightYear} ${brand.company}`,
  artifactName: `${brand.slug}-\${version}-setup.\${ext}`,
  win: { target: 'nsis', icon: brand.logo.icon },
  files: ['dist', 'dist-electron', 'build/icon.ico', 'build/tray-icon.png', 'build/logo-mark.svg'],
  extraResources: [{ from: 'helper/bin', to: 'helper', filter: ['dock-helper.*', '*.json'] }, { from: 'resources/icon-packs', to: 'icon-packs' }, { from: 'resources/cursor-packs', to: 'cursor-packs' }, { from: 'resources/tray', to: 'tray' }],
}
