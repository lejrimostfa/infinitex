// Slider panel. Writes through ix.set(), reads back on 'paramsChanged'.
// The sliders come from the family (impl.sliders).



// list: one InfinitexMaterial, or [ { name, ix } ] with a selector on top.
export function buildPanel( list ) {

	if ( ! Array.isArray( list ) ) list = [ { name: list.family, ix: list } ];
	const root = document.getElementById( 'sliders' );
	if ( list.length > 1 ) {

		const sel = document.createElement( 'select' );
		sel.innerHTML = list.map( ( e, i ) => `<option value="${ i }">${ e.name }</option>` ).join( '' );
		sel.style.cssText = 'width:100%;margin:2px 0 6px;background:#2a2c31;color:inherit;border:1px solid #3a3d44;border-radius:5px;padding:3px';
		root.before( sel );
		sel.onchange = () => show( list[ Number( sel.value ) ].ix );

	}

	const show = ( ix ) => { root.innerHTML = ''; fill( ix ); };
	show( list[ 0 ].ix );

}

function fill( ix ) {

	const root = document.getElementById( 'sliders' );
	const SLIDERS = ix.impl.sliders;
	const inputs = {};

	const color = document.createElement( 'label' );
	color.innerHTML = '<span>color</span><input type="color"><span></span>';
	const colorInput = color.querySelector( 'input' );
	colorInput.oninput = () => ix.set( { color: colorInput.value } );
	root.appendChild( color );

	for ( const [ key, min, max, step ] of SLIDERS ) {

		const label = document.createElement( 'label' );
		label.innerHTML = `<span>${ key.replaceAll( '_', ' ' ) }</span><input type="range" min="${ min }" max="${ max }" step="${ step }"><span></span>`;
		const input = label.querySelector( 'input' );
		input.oninput = () => ix.set( { [ key ]: Number( input.value ) } );
		inputs[ key ] = [ input, label.lastElementChild ];
		root.appendChild( label );

	}

	const refresh = ( { detail } ) => {

		colorInput.value = detail.preset.color;
		for ( const key in inputs ) {

			inputs[ key ][ 0 ].value = detail.preset[ key ];
			inputs[ key ][ 1 ].textContent = detail.preset[ key ];

		}

	};
	if ( ix.__panelRefresh ) {

		ix.removeEventListener( 'paramsChanged', ix.__panelRefresh );

	}

	ix.__panelRefresh = refresh;
	ix.addEventListener( 'materialReady', refresh );
	ix.addEventListener( 'paramsChanged', refresh );
	refresh( { detail: { preset: ix.preset } } );

}
