// What a frame costs and what to cut (infinitex/perf). No import: the
// command line tool (bin/infinitex-perf.mjs) injects this file into any page.
//
//   await auditFrame( { renderer, scene, frame } )
//     frame: async () => draws one frame of the game (default: render
//     scene with the first camera found). Hooks the renderer for that one
//     frame and returns:
//       passes     each render call: shadow, scene (main, mirror, probe) or
//                  post, its target size and its draws
//       draws      per frame, triangles per frame
//       objects    the 15 objects drawn most often (draws, passes)
//       findings   what to do, most draws saved first: { id, saves, fix,
//                  objects }. Ids:
//         shadow-repeat  a shadow map drawn more than once in the frame
//         instance       separate meshes sharing geometry and material:
//                        createInstances()
//         parts          many mesh parts under one parent, one material:
//                        skinParts() (moving parts) or merge (static)
//         shadow-nocull  casts a shadow and is never culled: drawn in
//                        every cascade whatever its place
//         nocull         frustumCulled false on a heavy mesh
//         heavy          a mesh over 100 k triangles drawn in several
//                        passes: LOD, a coarser grid, a clipmap
//         pixel-ratio    pixel ratio above 1.5: the kit's maxPixelRatio
//                        (1.25) with fxaa or taa
// The audit only reads. Prove each fix with the stills and the bench of
// bin/infinitex-perf.mjs (the image must not change).
//
// Event bus: none.

export async function auditFrame( { renderer: R, scene, frame = null } = {} ) {

	const proto = Object.getPrototypeOf( R );
	const camera = scene.getObjectByProperty( 'isCamera', true );
	const draw = frame ?? ( async () => R.render( scene, camera ) );
	const passes = [], seen = new Map();
	let pass = null;
	R.render = function ( s, c ) {

		const rt = R.getRenderTarget();
		const prev = pass;
		const kind = s.name?.startsWith( 'Shadow' ) ? 'shadow' : s.isScene && ! s.isQuadMesh && s.children?.length > 1 ? 'scene' : 'post';
		pass = { kind, name: s.name || s.type, camera: c.type, target: rt ? `${ rt.width }x${ rt.height }` : 'screen', draws: 0, tris: 0, key: s.name };
		passes.push( pass );
		try { return proto.render.call( R, s, c ); } finally { pass = prev; }

	};
	R.renderObject = function ( o, s, c, g, m, gr, ...rest ) {

		if ( pass ) {

			const n = ( gr ? gr.count : g.index ? g.index.count : g.attributes.position.count ) / 3 * ( o.count || 1 );
			pass.draws ++;
			pass.tris += n;
			let e = seen.get( o );
			if ( ! e ) seen.set( o, e = { o, draws: 0, kinds: new Set(), tris: n } );
			e.draws ++;
			e.kinds.add( pass.kind );

		}

		return proto.renderObject.call( R, o, s, c, g, m, gr, ...rest );

	};
	try { await draw(); } finally { delete R.render; delete R.renderObject; }

	const draws = passes.reduce( ( a, p ) => a + p.draws, 0 );
	const tris = passes.reduce( ( a, p ) => a + p.tris, 0 );
	const label = ( o ) => { for ( let p = o; p; p = p.parent ) if ( p.name && ! p.isScene ) return p === o ? o.name : `${ p.name } > ${ o.type }`; return `${ o.type }#${ o.id }`; };
	const findings = [];

	// A shadow map scene drawn more than once (three names it per map).
	const shadowCount = {};
	for ( const p of passes ) if ( p.kind === 'shadow' ) shadowCount[ p.key ] = ( shadowCount[ p.key ] ?? 0 ) + 1;
	const extra = passes.filter( ( p ) => p.kind === 'shadow' );
	const repeats = Object.values( shadowCount ).filter( ( n ) => n > 1 );
	if ( repeats.length ) {

		const per = extra.reduce( ( a, p ) => a + p.draws, 0 ) / extra.length;
		const waste = repeats.reduce( ( a, n ) => a + n - 1, 0 );
		findings.push( { id: 'shadow-repeat', saves: Math.round( per * waste ), fix: 'Render each shadow map once per frame. The kit\'s cascades (createSunCascades) do it; for another light set shadow.autoUpdate = false and shadow.needsUpdate = true once per frame. A second camera (mirror, waterline, probe) re-renders the maps otherwise.', objects: [ `${ waste } extra shadow passes` ] } );

	}

	// Separate meshes sharing geometry and material.
	const pairs = new Map();
	for ( const e of seen.values() ) {

		const o = e.o;
		if ( ! o.isMesh || o.isInstancedMesh || o.isSkinnedMesh ) continue;
		const k = o.geometry.uuid + '|' + [ o.material ].flat().map( ( m ) => m.uuid ).join( ',' );
		if ( ! pairs.has( k ) ) pairs.set( k, [] );
		pairs.get( k ).push( e );

	}

	const covered = new Set(); // meshes the instance finding already takes
	for ( const list of pairs.values() ) if ( list.length >= 3 ) {

		for ( const e of list ) covered.add( e.o );

		const total = list.reduce( ( a, e ) => a + e.draws, 0 );
		const passesEach = Math.max( ...list.map( ( e ) => e.kinds.size ) );
		findings.push( { id: 'instance', saves: total - passesEach, fix: 'createInstances( source, parent ) from infinitex/perf: one draw per part for all copies; move the stand-ins as before and call sync() once a frame.', objects: [ `${ list.length } x ${ label( list[ 0 ].o ) }` ] } );

	}

	// Many parts under one parent with one material.
	const byParent = new Map();
	for ( const e of seen.values() ) {

		const o = e.o;
		if ( ! o.isMesh || o.isInstancedMesh || ! o.parent || o.parent.isScene || covered.has( o ) ) continue; // parts of one object, not the scene's root
		const k = o.parent.uuid + '|' + o.material.uuid;
		if ( ! byParent.has( k ) ) byParent.set( k, [] );
		byParent.get( k ).push( e );

	}

	for ( const list of byParent.values() ) if ( list.length >= 4 ) {

		const total = list.reduce( ( a, e ) => a + e.draws, 0 );
		findings.push( { id: 'parts', saves: total - Math.round( total / list.length ), fix: 'skinParts( root ) from infinitex/perf if the parts move (bones keep their names), else merge them (BufferGeometryUtils.mergeGeometries).', objects: [ `${ list.length } parts of ${ label( list[ 0 ].o.parent ) }` ] } );

	}

	const shadowPasses = passes.filter( ( p ) => p.kind === 'shadow' ).length;
	const noCullCasters = [ ...seen.values() ].filter( ( e ) => e.o.castShadow && e.o.frustumCulled === false && ! e.o.isSkinnedMesh && e.kinds.has( 'shadow' ) ); // a skinned character is often left unculled on purpose (its bounds move)
	if ( noCullCasters.length && shadowPasses ) findings.push( { id: 'shadow-nocull', saves: noCullCasters.reduce( ( a, e ) => a + e.draws, 0 ), fix: 'Set frustumCulled back to true, or castShadow false for what is far from the shadowed area (clouds, sky props, distant cards).', objects: noCullCasters.slice( 0, 6 ).map( ( e ) => label( e.o ) ) } );

	const heavy = [ ...seen.values() ].filter( ( e ) => e.tris > 1e5 );
	const noCull = heavy.filter( ( e ) => e.o.frustumCulled === false );
	if ( noCull.length ) findings.push( { id: 'nocull', saves: 0, fix: 'frustumCulled false on a heavy mesh: it is drawn whatever the view. Cull it, or split it in tiles that cull.', objects: noCull.map( ( e ) => `${ label( e.o ) } (${ Math.round( e.tris / 1e3 ) } k tris)` ) } );
	const multi = heavy.filter( ( e ) => e.draws > 1 );
	if ( multi.length ) findings.push( { id: 'heavy', saves: 0, fix: 'Over 100 k triangles, drawn in several passes: a coarser grid away from the eye (LOD, clipmap), or hide it from passes that do not show it (a mirror below the water level, a shadow it cannot cast).', objects: multi.map( ( e ) => `${ label( e.o ) } (${ Math.round( e.tris / 1e3 ) } k tris x ${ e.draws })` ) } );

	const ratio = R.getPixelRatio();
	if ( ratio > 1.5 ) findings.push( { id: 'pixel-ratio', saves: 0, fix: `Pixel ratio ${ ratio }: every pass shades ${ ( ( ratio / 1.25 ) ** 2 ).toFixed( 1 ) } times the pixels of 1.25. Camera kit: maxPixelRatio: 1.25 with fxaa: true (target mode) or taa: true. On the beach: 24 to 8 ms, edges checked on zoomed crops.`, objects: [] } );

	findings.sort( ( a, b ) => b.saves - a.saves );
	const objects = [ ...seen.values() ].sort( ( a, b ) => b.draws - a.draws ).slice( 0, 15 ).map( ( e ) => ( { name: label( e.o ), draws: e.draws, passes: [ ...e.kinds ].join( '+' ), tris: Math.round( e.tris ) } ) );
	return { pixelRatio: ratio, draws, tris: Math.round( tris ), passes: passes.map( ( { key, ...p } ) => ( { ...p, tris: Math.round( p.tris ) } ) ), objects, findings };

}
