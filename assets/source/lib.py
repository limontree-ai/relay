import math
import bpy
import numpy as np
from mathutils import Vector
from shapely.geometry import Polygon, Point, box as sbox, LineString, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity
from scipy.spatial import Delaunay

# palette: main white and black, accents from the new palette
GREEN = '#A4CF4A'
MENTHE = '#35C8B4'
BRUME = '#C2F2E4'
LIMON = '#EDF7BE'
INK = '#15171c'
WHITE = '#F4F5F3'
GREY = '#d9dcd9'


def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexc(h, a=1.0):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return (lin(r), lin(g), lin(b), a)


def sin_(node, names, value):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return


_MATS = {}


def clay(hexcol, rough=0.78, bump=0.22):
    key = ('clay', hexcol, rough, bump)
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new('clay_' + hexcol)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexc(hexcol)
    b.inputs['Roughness'].default_value = rough
    sin_(b, ['Specular IOR Level', 'Specular'], 0.25)
    sin_(b, ['Subsurface Weight', 'Subsurface'], 0.06)
    sin_(b, ['Subsurface Scale'], 0.05)
    if bump > 0:
        n = nt.nodes.new('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = 90.0
        n.inputs['Detail'].default_value = 6.0
        n.inputs['Roughness'].default_value = 0.65
        bp = nt.nodes.new('ShaderNodeBump')
        bp.inputs['Strength'].default_value = bump
        bp.inputs['Distance'].default_value = 0.02
        nt.links.new(n.outputs['Fac'], bp.inputs['Height'])
        nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    _MATS[key] = m
    return m


def gloss(hexcol, rough=0.18, coat=0.6, emit=0.0):
    key = ('gloss', hexcol, rough, coat, emit)
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new('gloss_' + hexcol)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexc(hexcol)
    b.inputs['Roughness'].default_value = rough
    sin_(b, ['Coat Weight', 'Clearcoat'], coat)
    if emit > 0:
        sin_(b, ['Emission Color', 'Emission'], hexc(hexcol))
        sin_(b, ['Emission Strength'], emit)
    _MATS[key] = m
    return m


def glass(hexcol=WHITE, alpha=0.18):
    key = ('glass', hexcol, alpha)
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new('glass')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexc(hexcol)
    b.inputs['Roughness'].default_value = 0.08
    b.inputs['Alpha'].default_value = alpha
    _MATS[key] = m
    return m


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _MATS.clear()


def _link(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def group(loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0, parent=None):
    e = bpy.data.objects.new('grp', None)
    _link(e, parent)
    e.location = loc
    e.rotation_euler = [math.radians(a) for a in rot]
    e.scale = (scale, scale, scale) if not hasattr(scale, '__len__') else scale
    return e


def smooth(obj):
    if obj.type == 'MESH':
        obj.data.shade_smooth()


def apply_mods(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    obj.modifiers.clear()
    old = obj.data
    obj.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)
    me.shade_smooth()


def puffy(obj, width=0.1, seg=6, sub=2):
    bv = obj.modifiers.new('bv', 'BEVEL')
    bv.width = width
    bv.segments = seg
    bv.limit_method = 'NONE'
    bv.use_clamp_overlap = True
    ss = obj.modifiers.new('ss', 'SUBSURF')
    ss.levels = sub
    ss.render_levels = sub
    smooth(obj)
    return obj


def _prim(kind, **kw):
    getattr(bpy.ops.mesh, kind)(**kw)
    return bpy.context.active_object


def _finish(o, mat, loc, rot, parent):
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    if mat is not None:
        o.data.materials.append(mat)
    # move into scene collection root and parent
    for c in list(o.users_collection):
        c.objects.unlink(o)
    _link(o, parent)
    return o


def box(size, loc=(0, 0, 0), mat=None, r=0.1, rot=(0, 0, 0), parent=None, sub=2):
    o = _prim('primitive_cube_add', size=1)
    o.scale = size
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(scale=True)
    puffy(o, r, 6, sub)
    return _finish(o, mat, loc, rot, parent)


def sphere(r, loc=(0, 0, 0), mat=None, scale=(1, 1, 1), rot=(0, 0, 0), parent=None, seg=48):
    o = _prim('primitive_uv_sphere_add', segments=seg, ring_count=seg // 2, radius=r)
    o.scale = scale
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(scale=True)
    smooth(o)
    return _finish(o, mat, loc, rot, parent)


def cyl(r, h, loc=(0, 0, 0), mat=None, rot=(0, 0, 0), parent=None, bev=0.06):
    o = _prim('primitive_cylinder_add', radius=r, depth=h, vertices=64)
    puffy(o, bev, 5, 2)
    return _finish(o, mat, loc, rot, parent)


def cone(r1, r2, h, loc=(0, 0, 0), mat=None, rot=(0, 0, 0), parent=None, bev=0.05):
    o = _prim('primitive_cone_add', radius1=r1, radius2=r2, depth=h, vertices=64)
    puffy(o, bev, 5, 2)
    return _finish(o, mat, loc, rot, parent)


def torus(R, r, loc=(0, 0, 0), mat=None, rot=(0, 0, 0), parent=None):
    o = _prim('primitive_torus_add', major_radius=R, minor_radius=r, major_segments=96, minor_segments=32)
    smooth(o)
    return _finish(o, mat, loc, rot, parent)


def tube(points, r, mat=None, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), cyclic=False):
    cu = bpy.data.curves.new('tube', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 8
    cu.use_fill_caps = True
    cu.resolution_u = 24
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(points) - 1)
    for i, p in enumerate(points):
        bp = sp.bezier_points[i]
        bp.co = p
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    sp.use_cyclic_u = cyclic
    o = bpy.data.objects.new('tube', cu)
    if mat is not None:
        cu.materials.append(mat)
    _link(o, parent)
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    return o


def polyline_tube(points, r, mat=None, parent=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    """straight segments with rounded joins and caps, for brackets and slashes"""
    cu = bpy.data.curves.new('ptube', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 8
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY')
    sp.points.add(len(points) - 1)
    for i, p in enumerate(points):
        sp.points[i].co = (p[0], p[1], p[2], 1)
    o = bpy.data.objects.new('ptube', cu)
    if mat is not None:
        cu.materials.append(mat)
    _link(o, parent)
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    return o


def text(s, size, loc=(0, 0, 0), mat=None, depth=0.05, rot=(90, 0, 0), parent=None, bevel=0.018):
    cu = bpy.data.curves.new('txt', 'FONT')
    cu.body = s
    cu.size = size
    cu.extrude = depth
    cu.bevel_depth = bevel
    cu.bevel_resolution = 4
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    o = bpy.data.objects.new('txt', cu)
    if mat is not None:
        cu.materials.append(mat)
    _link(o, parent)
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    return o


# ---------------------------------------------------------------- 2D shapes
def rrect(w, h, r, cx=0, cy=0):
    r = min(r, w / 2 - 1e-3, h / 2 - 1e-3)
    return sbox(cx - w / 2 + r, cy - h / 2 + r, cx + w / 2 - r, cy + h / 2 - r).buffer(r, 24)


def circ(r, cx=0, cy=0):
    return Point(cx, cy).buffer(r, 48)


def rpoly(pts, r):
    """polygon with rounded corners"""
    return Polygon(pts).buffer(-r, join_style=1).buffer(r, 24, join_style=1)


def rounded(poly, r):
    return poly.buffer(r, 24).buffer(-r, 24)


def soften(poly, r):
    return poly.buffer(-r, 24).buffer(r, 24)


def union(*p):
    return unary_union(list(p))


def moveto(poly, x, y):
    return affinity.translate(poly, x, y)


def rotate2(poly, deg, origin=(0, 0)):
    return affinity.rotate(poly, deg, origin=origin)


def scale2(poly, sx, sy=None, origin=(0, 0)):
    return affinity.scale(poly, sx, sy if sy is not None else sx, origin=origin)


def line_stroke(pts, w):
    return LineString(pts).buffer(w / 2, 24)


def _rings(poly, bs, k=8, step=0.05):
    pts = []
    ds = [0.0] + [bs * (1 - math.cos(i / k * math.pi / 2)) for i in range(1, k + 1)]
    for d in ds:
        g = poly if d == 0 else poly.buffer(-d)
        if g.is_empty:
            continue
        geoms = list(g.geoms) if hasattr(g, 'geoms') else [g]
        for gg in geoms:
            bounds = [gg.exterior] + list(gg.interiors)
            for ring in bounds:
                n = max(8, int(ring.length / step))
                for i in range(n):
                    p = ring.interpolate(i / n, normalized=True)
                    pts.append((p.x, p.y))
    return pts


class Blob:
    """inflated 2D shape standing in the XZ plane, front facing -Y"""

    def __init__(self, poly, H=0.5, BS=0.5, step=0.06):
        self.poly = poly
        self.H = H
        self.BS = BS
        self.step = step
        self.bnd = poly.boundary

    def height(self, x, z):
        d = self.bnd.distance(Point(x, z))
        u = max(0.0, min(1.0, 1 - d / self.BS))
        return self.H * math.sqrt(max(0.0, 1 - u * u))

    def build(self, mat, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, sub=1):
        poly = self.poly
        pts = _rings(poly, self.BS, 9, self.step * 0.8)
        minx, miny, maxx, maxy = poly.bounds
        xs = np.arange(minx, maxx + self.step, self.step)
        ys = np.arange(miny, maxy + self.step, self.step)
        inner = poly.buffer(-self.BS * 0.98)
        for x in xs:
            for y in ys:
                p = Point(x, y)
                if inner.contains(p) if not inner.is_empty else False:
                    pts.append((x, y))
        if inner.is_empty:
            c = poly.representative_point()
            pts.append((c.x, c.y))
        P = np.array(pts)
        P = np.unique(np.round(P, 5), axis=0)
        tri = Delaunay(P)
        cent = P[tri.simplices].mean(axis=1)
        keep = []
        from shapely import contains_xy
        ok = contains_xy(poly, cent[:, 0], cent[:, 1])
        simp = tri.simplices[ok]
        # per vertex distance to boundary
        from shapely import distance, points as spoints
        d = distance(self.bnd, spoints(P[:, 0], P[:, 1]))
        u = np.clip(1 - d / self.BS, 0, 1)
        z = self.H * np.sqrt(np.clip(1 - u * u, 0, None))
        n = len(P)
        onb = d < 1e-4
        verts = []
        for i in range(n):
            verts.append((P[i, 0], -z[i], P[i, 1]))
        back_idx = {}
        for i in range(n):
            if onb[i]:
                back_idx[i] = i
            else:
                back_idx[i] = len(verts)
                verts.append((P[i, 0], z[i], P[i, 1]))
        faces = []
        for a, b, c in simp:
            # front: normal toward -Y. vertices in XZ plane, check winding
            ax, az = P[a]; bx, bz = P[b]; cx, cz = P[c]
            cross = (bx - ax) * (cz - az) - (bz - az) * (cx - ax)
            f = (a, b, c) if cross > 0 else (a, c, b)
            # (x,z) ccw viewed from +Y looking -Y; flip so normal faces -Y
            faces.append((f[0], f[2], f[1]))
            g = (back_idx[a], back_idx[b], back_idx[c])
            if cross > 0:
                faces.append((g[0], g[1], g[2]))
            else:
                faces.append((g[0], g[2], g[1]))
        me = bpy.data.meshes.new('blob')
        me.from_pydata(verts, [], faces)
        me.update()
        me.validate()
        o = bpy.data.objects.new('blob', me)
        me.materials.append(mat)
        _link(o, parent)
        o.location = loc
        o.rotation_euler = [math.radians(a) for a in rot]
        bpy.context.view_layer.objects.active = o
        # fix normals consistently outward
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        sm = o.modifiers.new('sm', 'SMOOTH')
        sm.factor = 0.5
        sm.iterations = 10
        ss = o.modifiers.new('ss', 'SUBSURF')
        ss.levels = sub
        ss.render_levels = sub
        me.shade_smooth()
        return o


def blob(poly, mat, H=0.5, BS=0.5, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, step=0.06, sub=1):
    b = Blob(poly, H, BS, step)
    return b.build(mat, loc, rot, parent, sub)


# ---------------------------------------------------------------- scene
def eye_pair(p, y, z, dx=0.5, sx=1.0, sz=1.0, hi=True, closed=False):
    em = gloss('#0b0c0f', 0.18, 0.6)
    wm = gloss('#ffffff', 0.3, 0.0, emit=1.6)
    for s in (-1, 1):
        if closed:
            tube([(s * dx - 0.09, y, z + 0.02), (s * dx, y, z - 0.03), (s * dx + 0.09, y, z + 0.02)], 0.022, em, p)
            continue
        e = sphere(0.1, (s * dx, y, z), em, (0.85 * sx, 0.5, 1.75 * sz), parent=p)
        if hi:
            sphere(0.03, (s * dx - 0.03 * sx, y - 0.043, z + 0.1 * sz), wm, (0.8, 0.5, 1.3), parent=p)


def make_scene(root, res=1024, samples=40, yaw=-18, pitch=6):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x = res
    sc.render.resolution_y = res
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'

    root.rotation_euler = (math.radians(pitch), 0, math.radians(yaw))
    bpy.context.view_layer.update()

    # bounding sphere of everything
    mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
    dg = bpy.context.evaluated_depsgraph_get()
    any_obj = False
    for o in bpy.data.objects:
        if o.type in ('MESH', 'CURVE', 'FONT'):
            ev = o.evaluated_get(dg)
            try:
                for c in ev.bound_box:
                    w = ev.matrix_world @ Vector(c)
                    for i in range(3):
                        mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
                any_obj = True
            except Exception:
                pass
    ctr = (mn + mx) / 2
    rad = max((mx - mn).length / 2, 0.5)

    tgt = bpy.data.objects.new('tgt', None)
    _link(tgt)
    tgt.location = ctr

    world = bpy.data.worlds.new('W')
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = hexc('#f2f4f2')
    bg.inputs['Strength'].default_value = 0.35

    def area(name, off, energy, size, color):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy * 0.8 * (rad / 1.8) ** 2
        ld.size = size * rad / 1.8
        ld.color = color
        lo = bpy.data.objects.new(name, ld)
        lo.location = ctr + Vector(off) * (rad / 1.8)
        _link(lo)
        c = lo.constraints.new('TRACK_TO')
        c.target = tgt
        c.track_axis = 'TRACK_NEGATIVE_Z'
        c.up_axis = 'UP_Y'

    area('Key', (-3.2, -4.2, 3.6), 480, 4.5, (1.0, 0.98, 0.95))
    area('Fill', (4.0, -3.0, 1.0), 220, 5.0, (0.92, 0.97, 1.0))
    area('Rim', (1.5, 3.5, 3.0), 380, 3.0, (1, 1, 1))

    cd = bpy.data.cameras.new('Cam')
    cd.lens = 70
    cam = bpy.data.objects.new('Cam', cd)
    fov = 2 * math.atan(18 / 70)
    dist = rad / math.tan(fov / 2) * 1.12
    cam.location = ctr + Vector((0, -dist, 0))
    _link(cam)
    tc = cam.constraints.new('TRACK_TO')
    tc.target = tgt
    tc.track_axis = 'TRACK_NEGATIVE_Z'
    tc.up_axis = 'UP_Y'
    sc.camera = cam


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
