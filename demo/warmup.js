// Material streaming for pages with many matters (the cube wall).
//
// Each Infinitex matter is its own shader. Compiled on first draw, inside
// the render loop, every new one froze a frame: 241 cubes took 3 minutes
// at about 1 frame per second. Here the meshes wear a cheap placeholder
// (already compiled) and their real material compiles in the background
// with renderer.compileAsync(): the node build yields to the main thread
// and the GPU pipelines build in parallel. Each mesh swaps to its real
// material once its pipelines are ready, nearest first, so the page keeps
// its frame rate while the wall fills in.
//
// The compile runs in the context of the pass that draws the scene (its
// render target and MRT), so the pipelines match the ones of the render
// and the swap costs nothing. Children (fuzz shells, hair) are detached
// until their parent is ready, and compiled with it.
//
// Events: dispatches 'materialReady' { mesh, done, total } per mesh and
// 'allReady' { total } at the end on the returned EventTarget.

import { Vector2, Object3D } from 'three/webgpu';

const _size = new Vector2();

// Two parts of the pass's state that compileAsync does not keep. Its work
// items run later, between frames; without them every matter compiled a
// second time, synchronously, on its first real draw (200 to 1000 ms per
// batch of 8):
//   context  the scene pass carries the AO of the lighting (camera/post.js)
//            in a context node, part of every render object's cache key
//   lights   the hair pass draws the same scene with the same camera, so it
//            shares the scene pass's lights node, and it sees no light (hair
//            layer only): the items that ran after it compiled without sun,
//            and three caches the environment key per draw count
//   copy     matters that read the screen copy it in their work item
// Here each work item queued for the pass's target runs with the context
// and the lights, and without the copy.
function keepPassState( renderer, pass, lights ) {

	if ( ! pass || renderer._ixPassState ) return;
	renderer._ixPassState = true;
	const begin = renderer._beginPreCompile, finish = renderer._finishPreCompile;
	renderer._beginPreCompile = function ( state ) {

		begin.call( this, state );
		if ( state.renderTarget !== pass.renderTarget ) return;
		if ( state.item ) {

			// The lights, and the environment key three caches per draw count
			// (computed by then with the hair pass's empty list).
			state.item.lightsNode.setLights( lights );
			this._nodes.callHashCache.delete( [ state.item.scene, state.item.lightsNode ] );

		}

		if ( pass.contextNode !== null ) {

			state.ixContext = this.contextNode;
			this.contextNode = pass._getContextNode( this );

		}

	};

	renderer._finishPreCompile = function () {

		const state = this._precompilationState;
		if ( state && state.ixContext !== undefined ) {

			this.contextNode = state.ixContext;
			delete state.ixContext;

		}

		finish.call( this );

	};

	// Matters that read the screen (glass, amber, a soap bubble: their
	// transmission samples a copy of the frame drawn so far). The work item
	// runs the copy, which reads the context of the canvas into a texture
	// of the pass's format and fails, so they used to compile on their first
	// real draw (1 to 3 s, once). A compile draws nothing, so the copy is
	// skipped: only the copy texture is created, with the pass's format, as
	// the real draw will use it.
	const copy = renderer.copyFramebufferToTexture;
	renderer.copyFramebufferToTexture = function ( texture, rectangle = null ) {

		if ( this._precompilationState === null || this._renderTarget !== pass.renderTarget ) return copy.call( this, texture, rectangle );
		this._textures.updateTexture( texture, { renderTarget: pass.renderTarget } );

	};

}

// The shadow of an opaque matter. three builds it from the material's whole
// colour graph, for an alpha that only alpha tests and transparent shadows
// read: one more shader per matter, built synchronously on its first draw
// (about 20 ms each). An opaque matter without alpha test or mask casts the
// plain shadow of its geometry instead, one pipeline shared by all (its
// displacement, a fraction of a millimetre, is not in the shadow).
function plainShadow( renderer, material ) {

	const cache = renderer._cacheShadowNodes;
	if ( ! cache || material.transparent || material.alphaTest > 0 || material.transmission > 0 || material.maskNode || material.maskShadowNode || material.castShadowNode || material.castShadowPositionNode ) return;
	cache.set( material, { version: material.version, colorNode: null, depthNode: null, positionNode: null } );

}

export function streamMaterials( { renderer, scene, camera, pass, meshes, placeholder, batchSize = 8 } ) {

	const bus = new EventTarget();
	const lights = [];
	scene.traverseVisible( ( o ) => { if ( o.isLight && ( ! pass?.getLayers() || o.layers.test( pass.getLayers() ) ) ) lights.push( o ); } );
	keepPassState( renderer, pass, lights );
	const real = new Map(), kids = new Map();
	for ( const m of meshes ) {

		real.set( m, m.material );
		kids.set( m, [ ...m.children ] );
		m.material = placeholder;
		for ( const c of kids.get( m ) ) m.remove( c );

	}

	// Queue a batch of meshes (and their children) for compilation, as
	// `pass` draws them. compileAsync keeps one compile state on the
	// renderer, so calls run one after the other; inside a call the GPU
	// pipelines build in parallel. The batch hangs under a stand-in root
	// (children listed, not reparented: the world matrices stay as they
	// are). Synchronous up to the first await of compileAsync (the
	// projection): the render state is restored right after, and
	// compileAsync reapplies its own snapshot to each item, so the render
	// loop runs in between.
	function compileBatch( batch ) {

		if ( ! batch.length ) return;
		const target = renderer.getRenderTarget(), mrt = renderer.getMRT(), mask = camera.layers.mask;
		const culled = [];
		for ( const m of batch ) {

			m.material = real.get( m );
			for ( const c of kids.get( m ) ) m.add( c );
			m.traverse( ( o ) => { culled.push( [ o, o.frustumCulled ] ); o.frustumCulled = false; } ); // off-screen cubes too

		}

		root.children = batch;
		if ( pass ) {

			pass.renderTarget.samples = pass.options.samples === undefined ? renderer.samples : pass.options.samples;
			renderer.getDrawingBufferSize( _size );
			pass.setSize( _size.x, _size.y );
			renderer.setRenderTarget( pass.renderTarget );
			renderer.setMRT( pass.getMRT() );
			if ( pass.getLayers() ) camera.layers.mask = pass.getLayers().mask;

		}

		let done;
		try {

			done = renderer.compileAsync( root, camera, scene );

		} finally {

			root.children = [];
			renderer.setRenderTarget( target );
			renderer.setMRT( mrt );
			camera.layers.mask = mask;
			for ( const [ o, f ] of culled ) o.frustumCulled = f;
			for ( const m of batch ) {

				m.material = placeholder;
				for ( const c of kids.get( m ) ) m.remove( c );

			}

		}

		return done;

	}

	function swap( m ) {

		m.material = real.get( m );
		m.traverse( ( o ) => { if ( o.isMesh && o.castShadow ) plainShadow( renderer, o.material ); } );
		for ( const c of kids.get( m ) ) m.add( c );

	}

	const root = new Object3D();
	root.matrixWorldAutoUpdate = false; // keep the meshes' own world matrices
	const total = meshes.length;
	const frame = () => new Promise( ( r ) => requestAnimationFrame( r ) );
	bus.finished = ( async () => {

		// The pass sets its target up on its first render: a compile before
		// it built the first cube for a target without the normal output.
		await frame();
		await frame();
		let done = 0;
		for ( let i = 0; i < total; i += batchSize ) {

			const batch = meshes.slice( i, i + batchSize );
			try {

				await compileBatch( batch ); // screen-reading matters too (keepPassState skips their copy)

			} catch ( e ) {

				console.warn( 'warmup: compile failed, drawing the batch anyway', batch.map( ( m ) => m.name ), e );

			}

			for ( const m of batch ) {

				swap( m );
				bus.dispatchEvent( new CustomEvent( 'materialReady', { detail: { mesh: m, done: ++ done, total } } ) );

			}

		}

		bus.dispatchEvent( new CustomEvent( 'allReady', { detail: { total } } ) );

	} )();
	return bus;

}
