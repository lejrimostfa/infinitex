// Dev server and the static build of the public demos (GitHub Pages).
// base './' keeps every URL relative, so the build works under any path.
// Only the public demos are built (character.html: the riveraine, the one
// game character published). The other pages need models that are not.
export default {
	base: './',
	build: {
		target: 'esnext',
		rollupOptions: { input: { index: 'index.html', character: 'character.html', cubes: 'cubes.html', aquarium: 'aquarium.html', livingroom: 'livingroom.html' } },
	},
	optimizeDeps: { esbuildOptions: { target: 'esnext' } },
};
