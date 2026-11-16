// A Vite server rooted at the Infinitex package, for the family check.
// Works in this repository and from a game project that installed
// Infinitex (npm i github:lejrimostfa/infinitex): vite is found from the
// package, or from the game's node_modules. A family outside the package
// is served under /@fs/. dedupe keeps one copy of three: a family in a
// game project and the library must share it, or TSL nodes do not mix.

export async function startServer( pkgRoot, allow = [] ) {

	let vite;
	try { vite = await import( 'vite' ); } catch { throw new Error( 'infinitex-check needs vite: npm i -D vite' ); }
	const server = await vite.createServer( {
		root: pkgRoot, configFile: false, logLevel: 'error', appType: 'mpa',
		server: { port: 5290, strictPort: false, fs: { allow: [ pkgRoot, ...allow ] } },
		resolve: { dedupe: [ 'three' ] },
		optimizeDeps: { esbuildOptions: { target: 'esnext' } },
	} );
	await server.listen();
	return { url: server.resolvedUrls.local[ 0 ], close: () => server.close() };

}
