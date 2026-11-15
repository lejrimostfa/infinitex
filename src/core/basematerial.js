// Nodes of an existing glTF / MeshStandardMaterial, so a procedural family
// can replace it only where a mask says so (a garment inside an atlas).
// The normal map uses a tangent frame from screen derivatives of the atlas
// UVs: the mesh's own tangent attribute belongs to the knit coordinates.

import {
	texture, uv, vec3, float, mix, smoothstep, dFdx, dFdy, normalView, tangentView, bitangentView, tangentViewFrame, bitangentViewFrame,
} from 'three/tsl';

// opts.atlasRot: node of the ixAtlasRot attribute (tools/knitCoords.js).
// With it, the normal map uses a smooth per-vertex frame; without it, a
// frame from screen derivatives (constant per triangle).
export function baseFromStandard( m, opts = {} ) {

	const auv = uv();
	const color = m.map ? texture( m.map, auv ).rgb.mul( m.color ) : vec3( m.color );
	let normal = normalView;
	if ( m.normalMap ) {

		const t = texture( m.normalMap, auv ).xyz.mul( 2 ).sub( 1 );
		const s = m.normalScale ?? { x: 1, y: 1 };
		let T = tangentViewFrame, B = bitangentViewFrame;
		if ( opts.atlasRot ) {

			const r = opts.atlasRot;
			T = tangentView.mul( r.x ).add( bitangentView.mul( r.y ) ).normalize();
			B = normalView.cross( T ).mul( r.z );

		}

		normal = T.mul( t.x.mul( s.x ) ).add( B.mul( t.y.mul( s.y ) ) ).add( normalView.mul( t.z ) ).normalize();
		// Magnified far past its resolution, a normal map shows its bilinear
		// facets. Fade it out once a texel spans more than about 6 pixels:
		// at that zoom the procedural relief has taken over.
		const size = m.normalMap.image?.width ?? 2048;
		const texelsPerPx = dFdx( auv ).length().max( dFdy( auv ).length() ).mul( size );
		normal = mix( normalView, normal, smoothstep( 0.04, 0.16, texelsPerPx ) ).normalize();

	}

	// glTF metallicRoughness: roughness in G, metalness in B.
	const mr = m.roughnessMap ? texture( m.roughnessMap, auv ) : null;
	const roughness = mr ? mr.g.mul( m.roughness ) : float( m.roughness );
	const metalness = m.metalnessMap ? texture( m.metalnessMap, auv ).b.mul( m.metalness ) : float( m.metalness );
	// Emissive (some toon exports light the model by its own colour map).
	let emissive = null;
	if ( m.emissiveMap || ( m.emissive && m.emissive.getHex() !== 0 ) ) {

		emissive = ( m.emissiveMap ? texture( m.emissiveMap, auv ).rgb : vec3( 1 ) ).mul( m.emissive ).mul( m.emissiveIntensity ?? 1 );

	}

	return { color, normal, roughness, metalness, emissive };

}
