import * as esbuild from 'esbuild'

// Bundle the entire extension + @mcpspend/proxy + cross-spawn into a single
// dist/extension.js. The resulting .vsix is fully self-contained — no runtime
// dependencies, no @mcpspend/proxy version coupling at install time.
//
// To pick up newer proxy code: rebuild proxy (tsc), then rebuild this (esbuild
// re-reads the source). CI does this automatically in publish-extension.yml.

const watch = process.argv.includes('--watch')

const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  // vscode is provided by the host at runtime — never bundle it
  external: ['vscode'],
  sourcemap: !watch,
  minify: !watch,
  logLevel: 'info',
})

if (watch) {
  await ctx.watch()
  console.log('esbuild: watching for changes…')
} else {
  await ctx.rebuild()
  await ctx.dispose()
}
