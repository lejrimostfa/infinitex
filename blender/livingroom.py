# Living room on a volcano: the geometry of demo/livingroom.html.
# Built by code in Blender (free, reproducible), exported as one GLB.
# Blender only shapes the scene. The look comes from Infinitex in the page:
# each mesh carries one material slot named ix_<key>, and the page puts the
# matching procedural matter on it (demo/livingroom.js, MATTERS).
# UVs are in metres on the surface (procedural matters need the true
# scale): boxes get a box projection in world metres, spheres their own
# UVs stretched to their circumference.
# Run in Blender (live or --background):
#   exec(open("/Users/mostfa/infinitex/blender/livingroom.py").read())
# Writes demo/assets/livingroom.glb. Blender is Z up; glTF turns it Y up.

import bpy, bmesh, math
from mathutils import Vector

OUT = "/Users/mostfa/infinitex/demo/assets/livingroom.glb"
W, D, H = 6.0, 5.0, 2.8  # room (m): x across, y toward the window, z up
WIN = ( - 2.2, 2.2, 0.45, 2.45 )  # window opening on the far wall: x0, x1, z0, z1


def reset():

	for o in list( bpy.data.objects ):
		bpy.data.objects.remove( o, do_unlink = True )
	for m in list( bpy.data.meshes ):
		bpy.data.meshes.remove( m )
	for m in list( bpy.data.materials ):
		bpy.data.materials.remove( m )


def mat( key ):

	name = "ix_" + key
	m = bpy.data.materials.get( name ) or bpy.data.materials.new( name )
	return m


def finish( o, key, bevel = 0.0, uvmode = "box" ):

	o.data.materials.clear()
	o.data.materials.append( mat( key ) )
	if bevel > 0:
		b = o.modifiers.new( "bevel", "BEVEL" )
		b.width = bevel
		b.segments = 3
		b.limit_method = "ANGLE"
	o[ "uvmode" ] = uvmode
	return o


def box( name, size, loc, key, bevel = 0.0, rot = 0.0 ):

	bpy.ops.mesh.primitive_cube_add( size = 1, location = loc )
	o = bpy.context.active_object
	o.name = name
	o.scale = size
	o.rotation_euler.z = rot
	return finish( o, key, bevel )


def cyl( name, r, h, loc, key, verts = 48, bevel = 0.0 ):

	bpy.ops.mesh.primitive_cylinder_add( radius = r, depth = h, vertices = verts, location = loc )
	o = bpy.context.active_object
	o.name = name
	return finish( o, key, bevel )


def ball( name, r, loc, key, scale = ( 1, 1, 1 ), seg = 48 ):

	bpy.ops.mesh.primitive_uv_sphere_add( radius = r, segments = seg, ring_count = seg // 2, location = loc )
	o = bpy.context.active_object
	o.name = name
	o.scale = scale
	bpy.ops.object.shade_smooth()
	return finish( o, key, uvmode = "sphere" )


def room():

	floor()
	box( "ceiling", ( W, D, 0.04 ), ( 0, 0, H + 0.02 ), "plaster" )
	box( "wall_back", ( W, 0.12, H ), ( 0, - D / 2 - 0.06, H / 2 ), "plaster" )
	box( "wall_left", ( 0.12, D, H ), ( - W / 2 - 0.06, 0, H / 2 ), "plaster" )
	box( "wall_right", ( 0.12, D, H ), ( W / 2 + 0.06, 0, H / 2 ), "plaster" )
	# The window wall: four pieces around the opening.
	x0, x1, z0, z1 = WIN
	y = D / 2 + 0.06
	box( "wall_win_left", ( x0 + W / 2, 0.12, H ), ( ( - W / 2 + x0 ) / 2, y, H / 2 ), "plaster" )
	box( "wall_win_right", ( W / 2 - x1, 0.12, H ), ( ( W / 2 + x1 ) / 2, y, H / 2 ), "plaster" )
	box( "wall_win_sill", ( x1 - x0, 0.12, z0 ), ( 0, y, z0 / 2 ), "plaster" )
	box( "wall_win_head", ( x1 - x0, 0.12, H - z1 ), ( 0, y, ( H + z1 ) / 2 ), "plaster" )
	# Frame and a transom, wood.
	f = 0.07
	box( "frame_l", ( f, 0.16, z1 - z0 ), ( x0 + f / 2, y, ( z0 + z1 ) / 2 ), "wood", 0.006 )
	box( "frame_r", ( f, 0.16, z1 - z0 ), ( x1 - f / 2, y, ( z0 + z1 ) / 2 ), "wood", 0.006 )
	box( "frame_b", ( x1 - x0, 0.22, f ), ( 0, y - 0.03, z0 + f / 2 ), "wood", 0.006 )
	box( "frame_t", ( x1 - x0, 0.16, f ), ( 0, y, z1 - f / 2 ), "wood", 0.006 )
	box( "transom", ( x1 - x0, 0.1, 0.05 ), ( 0, y, 2.05 ), "wood", 0.006 )
	box( "skirting", ( W, 0.02, 0.1 ), ( 0, - D / 2 + 0.01, 0.05 ), "wood", 0.003 )


def floor():

	# Oak strips 16 cm wide running toward the window, random lengths,
	# staggered, 2 mm joints over a dark subfloor. Each strip has its own
	# UV offset, so its grain is its own cut of the tree.
	import random
	rnd = random.Random( 7 )
	box( "subfloor", ( W, D, 0.03 ), ( 0, 0, - 0.035 ), "rock" )
	w, gap = 0.16, 0.002
	n = int( W / w )
	for i in range( n ):
		x = - W / 2 + ( i + 0.5 ) * W / n
		y = - D / 2 + rnd.uniform( 0, 1.6 )
		first = True
		while y < D / 2:
			L = rnd.uniform( 1.0, 2.2 )
			y0 = - D / 2 if first else y
			y1 = min( D / 2, y + L )
			first = False
			if y1 - y0 > 0.05:
				o = box( f"plank{i}_{int( y0 * 100 )}", ( W / n - gap, y1 - y0 - gap, 0.02 ), ( x, ( y0 + y1 ) / 2, - 0.01 ), "wood", 0.0015 )
				o[ "uvmode" ] = "plank"
				o[ "off" ] = ( rnd.uniform( 0, 8 ), rnd.uniform( 0, 8 ) )
			y = y1


def furniture():

	# Rug in the middle of the room.
	box( "rug", ( 2.6, 1.8, 0.012 ), ( 0.1, 0.1, 0.006 ), "rug", 0.004 )
	# TV corner, left, facing the room (+x).
	box( "cabinet", ( 0.5, 1.3, 0.55 ), ( - 2.6, 0.2, 0.275 ), "wood", 0.01 )
	tv_x, tv_z = - 2.62, 0.55 + 0.25
	box( "tv_body", ( 0.46, 0.6, 0.48 ), ( tv_x, 0.2, tv_z ), "plastic", 0.035 )
	box( "tv_back", ( 0.24, 0.42, 0.34 ), ( tv_x - 0.3, 0.2, tv_z - 0.02 ), "plastic", 0.04 )
	screen()
	for i, zz in enumerate( ( 0.13, 0.05 ) ):
		cyl( f"tv_knob{i}", 0.018, 0.02, ( tv_x + 0.235, 0.2 - 0.24, tv_z + zz - 0.1 ), "plastic", 24 ).rotation_euler.y = math.pi / 2
	# Armchair, right of the rug, facing the TV (-x).
	ax, ay = 0.9, 0.0
	box( "chair_seat", ( 0.75, 0.8, 0.22 ), ( ax, ay, 0.32 ), "leather", 0.05 )
	box( "chair_base", ( 0.7, 0.76, 0.2 ), ( ax, ay, 0.11 ), "leather", 0.03 )
	box( "chair_back", ( 0.2, 0.84, 0.75 ), ( ax + 0.36, ay, 0.68 ), "leather", 0.07 )
	box( "chair_arm_l", ( 0.82, 0.16, 0.36 ), ( ax + 0.02, ay - 0.45, 0.45 ), "leather", 0.06 )
	box( "chair_arm_r", ( 0.82, 0.16, 0.36 ), ( ax + 0.02, ay + 0.45, 0.45 ), "leather", 0.06 )
	# Side table with a bowl of oranges and a phone.
	tx, ty = 1.0, - 0.85
	cyl( "table_top", 0.28, 0.035, ( tx, ty, 0.55 ), "wood", 64, 0.008 )
	cyl( "table_leg", 0.035, 0.53, ( tx, ty, 0.265 ), "wood", 24 )
	cyl( "table_foot", 0.18, 0.02, ( tx, ty, 0.01 ), "wood", 48, 0.005 )
	bowl( ( tx - 0.08, ty + 0.06, 0.57 ) )
	for i, ( dx, dy, dz ) in enumerate( ( ( - 0.12, 0.05, 0.07 ), ( - 0.04, 0.08, 0.07 ), ( - 0.08, - 0.01, 0.075 ), ( - 0.09, 0.07, 0.14 ) ) ):
		ball( f"orange{i}", 0.038, ( tx + dx, ty + dy, 0.57 + dz - 0.02 ), "citrus", ( 1, 1, 0.94 ) )
	phone( ( tx + 0.14, ty - 0.06, 0.5675 ) )


def screen():

	# The tube's face: a slightly bulged rectangle, UV in metres from a corner.
	w, h, x = 0.5, 0.38, - 2.62 + 0.235
	bm = bmesh.new()
	n = 24
	verts = []
	for j in range( n + 1 ):
		row = []
		for i in range( n + 1 ):
			u, v = i / n, j / n
			bulge = 0.018 * ( 1 - ( 2 * u - 1 ) ** 2 ) * ( 1 - ( 2 * v - 1 ) ** 2 )
			row.append( bm.verts.new( ( x + 0.004 + bulge, 0.2 - w / 2 + u * w, 0.8 - h / 2 + v * h ) ) )
		verts.append( row )
	uvl = bm.loops.layers.uv.new( "UVMap" )
	for j in range( n ):
		for i in range( n ):
			f = bm.faces.new( ( verts[ j ][ i ], verts[ j ][ i + 1 ], verts[ j + 1 ][ i + 1 ], verts[ j + 1 ][ i ] ) )
			for l in f.loops:
				l[ uvl ].uv = ( ( l.vert.co.y - ( 0.2 - w / 2 ) ), ( l.vert.co.z - ( 0.8 - h / 2 ) ) )
	me = bpy.data.meshes.new( "tv_screen" )
	bm.to_mesh( me )
	o = bpy.data.objects.new( "tv_screen", me )
	bpy.context.collection.objects.link( o )
	for p in me.polygons:
		p.use_smooth = True
	finish( o, "crt", uvmode = "keep" )


def bowl( loc ):

	bpy.ops.mesh.primitive_uv_sphere_add( radius = 0.13, segments = 48, ring_count = 24, location = loc )
	o = bpy.context.active_object
	o.name = "bowl"
	bm = bmesh.new()
	bm.from_mesh( o.data )
	bmesh.ops.delete( bm, geom = [ v for v in bm.verts if v.co.z > 0.0 ], context = "VERTS" )
	bm.to_mesh( o.data )
	o.scale = ( 1, 1, 0.55 )
	o.location.z = loc[ 2 ] + 0.07
	s = o.modifiers.new( "solid", "SOLIDIFY" )
	s.thickness = 0.01
	bpy.ops.object.shade_smooth()
	finish( o, "wood" )


def phone( loc ):

	x, y, z = loc
	box( "phone_base", ( 0.14, 0.2, 0.07 ), ( x, y, z + 0.035 ), "plastic", 0.02 )
	box( "phone_handset", ( 0.05, 0.22, 0.035 ), ( x, y, z + 0.085 ), "plastic", 0.016 )
	cyl( "phone_dial", 0.045, 0.01, ( x, y + 0.02, z + 0.07 ), "plastic", 32, 0.003 ).rotation_euler.x = 0.25


def outside():

	# The house sits on a cliff. Below the window, a lava lake to the horizon.
	box( "lava", ( 600, 500, 0.5 ), ( 0, 260, - 9.0 ), "lava" )
	# Far ridges: plain dark rock (the page gives them a flat basalt).
	# On the sides, so the middle of the window stays open on the sun.
	for i, ( x, y, r, h ) in enumerate( ( ( - 170, 200, 70, 30 ), ( - 95, 260, 50, 16 ), ( 150, 230, 80, 34 ), ( 240, 300, 90, 26 ), ( 70, 380, 60, 12 ) ) ):
		bpy.ops.mesh.primitive_cone_add( vertices = 24, radius1 = r, radius2 = r * 0.12, depth = h, location = ( x, y, - 9 + h / 2 ) )
		o = bpy.context.active_object
		o.name = f"ridge{i}"
		finish( o, "rock" )
	# The cliff under the house and its rim.
	# Its top 6 cm under the floor: coplanar with the strips, it would
	# fight them for the depth buffer.
	box( "cliff", ( 30, 14, 9 ), ( 0, D / 2 - 4, - 4.56 ), "rock" )
	# The sun, low over the lake, a little left of the window's centre.
	# 22 m at 330 m: about 8 degrees across, a sunset sun swollen by haze.
	ball( "sun", 22.0, ( - 25, 330, 10 ), "sun", seg = 64 )


def metric_uvs():

	# Every mesh: apply transforms and modifiers, then UVs in metres.
	for o in [ o for o in bpy.data.objects if o.type == "MESH" ]:
		bpy.context.view_layer.objects.active = o
		for ob in bpy.context.selected_objects:
			ob.select_set( False )
		o.select_set( True )
		for m in list( o.modifiers ):
			bpy.ops.object.modifier_apply( modifier = m.name )
		bpy.ops.object.transform_apply( location = False, rotation = True, scale = True )
		mode = o.get( "uvmode", "box" )
		me = o.data
		if mode == "keep":
			continue
		if not me.uv_layers:
			me.uv_layers.new( name = "UVMap" )
		uv = me.uv_layers.active.data
		if mode == "sphere":
			# The sphere's own UVs: u around (circumference), v pole to pole.
			r = max( o.dimensions ) / 2
			for p in me.polygons:
				for li in p.loop_indices:
					a = uv[ li ].uv
					uv[ li ].uv = ( a[ 0 ] * 2 * math.pi * r, a[ 1 ] * math.pi * r )
			continue
		mw = o.matrix_world
		if mode == "plank":
			# Grain (u) along the strip (world y), its own offset.
			ou, ov = o[ "off" ]
			for p in me.polygons:
				for li in p.loop_indices:
					co = mw @ me.vertices[ me.loops[ li ].vertex_index ].co
					uv[ li ].uv = ( co.y + ou, co.x + ov )
			continue
		# Box projection in world metres, by the face's main axis.
		for p in me.polygons:
			n = p.normal
			ax = max( range( 3 ), key = lambda k: abs( n[ k ] ) )
			for li in p.loop_indices:
				co = mw @ me.vertices[ me.loops[ li ].vertex_index ].co
				if ax == 2:
					uv[ li ].uv = ( co.x, co.y )
				elif ax == 1:
					uv[ li ].uv = ( co.x, co.z )
				else:
					uv[ li ].uv = ( co.y, co.z )


def join_planks():

	# One mesh for the floor (a hundred strips would be a hundred draws).
	ps = [ o for o in bpy.data.objects if o.name.startswith( "plank" ) ]
	for o in bpy.context.selected_objects:
		o.select_set( False )
	for o in ps:
		o.select_set( True )
	bpy.context.view_layer.objects.active = ps[ 0 ]
	bpy.ops.object.join()
	ps[ 0 ].name = "floor"


def placeholder_look():

	# Rough Blender colours, only to preview the layout here.
	cols = { "wood": ( 0.35, 0.2, 0.1 ), "plaster": ( 0.7, 0.66, 0.6 ), "rug": ( 0.5, 0.08, 0.06 ), "plastic": ( 0.8, 0.75, 0.65 ),
		"crt": ( 0.05, 0.1, 0.08 ), "leather": ( 0.25, 0.1, 0.05 ), "citrus": ( 0.9, 0.4, 0.05 ), "lava": ( 0.05, 0.03, 0.02 ),
		"rock": ( 0.04, 0.035, 0.03 ), "sun": ( 1, 0.5, 0.15 ) }
	for m in bpy.data.materials:
		key = m.name[ 3: ]
		m.use_nodes = True
		b = next( n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED" )
		c = cols.get( key, ( 0.5, 0.5, 0.5 ) )
		b.inputs[ "Base Color" ].default_value = ( *c, 1 )
		if key in ( "sun", "lava" ):
			b.inputs[ "Emission Color" ].default_value = ( *c, 1 )
			b.inputs[ "Emission Strength" ].default_value = 20 if key == "sun" else 0.5


def export():

	bpy.ops.export_scene.gltf( filepath = OUT, export_format = "GLB", export_apply = True, export_materials = "PLACEHOLDER" if False else "EXPORT", export_yup = True )


def build():

	reset()
	room()
	furniture()
	outside()
	metric_uvs()
	join_planks()
	placeholder_look()
	export()
	print( "objects", len( bpy.data.objects ), "->", OUT )


build()
