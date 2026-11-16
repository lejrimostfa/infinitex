// Dev server and the static build of the public demos (GitHub Pages).
// base './' keeps every URL relative, so the build works under any path.
// Only the public demos are built. The other pages need game models
// that are not published.
export default {
	base: './',
	build: {
		target: 'esnext',
		rollupOptions: { input: { index: 'index.html', cubes: 'cubes.html', aquarium: 'aquarium.html', livingroom: 'livingroom.html' } },
	},
	optimizeDeps: { esbuildOptions: { target: 'esnext' } },
};
