// Builds the C# helper into helper/bin. Skips quietly (with a warning) when the .NET SDK is missing,
// so the JS side can still be worked on.
import { spawnSync } from 'node:child_process'

const probe = spawnSync('dotnet', ['--version'], { encoding: 'utf-8' })
if (probe.status !== 0) {
  console.warn('warning: .NET SDK not found — helper not built (running apps, shell icons and recycle bin will not work)')
  process.exit(0)
}
const build = spawnSync('dotnet', ['build', 'helper', '-c', 'Release', '-o', 'helper/bin', '--nologo', '-v', 'q'], { stdio: 'inherit' })
process.exit(build.status ?? 1)
