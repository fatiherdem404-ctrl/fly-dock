// Everything name-related comes from src/config/brand.config.json.
const brand = require('./src/config/brand.config.json')

module.exports = {
  appId: brand.appId,
  productName: brand.name,
  copyright: `Copyright © ${brand.copyrightYear} ${brand.company}`,
  artifactName: `${brand.slug}-\${version}-setup.\${ext}`,
  win: { target: 'nsis', icon: brand.logo.icon },
  files: ['dist', 'dist-electron'],
  extraResources: [{ from: 'helper/bin', to: 'helper', filter: ['dock-helper.*', '*.json'] }],
}
