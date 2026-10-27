// Builds the C# helper into helper/bin. Skips quietly (with a warning) when the .NET SDK is missing,
// so the JS side can still be worked on.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const probe = spawnSync('dotnet', ['--version'], { encoding: 'utf-8' })
if (probe.status !== 0) {
  console.warn('warning: .NET SDK not found — helper not built (running apps, shell icons and recycle bin will not work)')
  process.exit(0)
}
const build = spawnSync('dotnet', ['build', 'helper', '-c', 'Release', '-o', 'helper/bin', '--nologo', '-v', 'q'], { stdio: 'inherit' })
if (build.status !== 0 && existsSync('helper/bin/dock-helper.exe')) {
  // a running dock keeps the old helper locked; carry on with the build that is already there
  console.warn('warning: helper could not be rebuilt (is a dock still running?) - using the existing helper/bin build')
  process.exit(0)
}
process.exit(build.status ?? 1)
