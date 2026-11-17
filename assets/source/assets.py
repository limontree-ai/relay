from lib import *
import math

REG = {}


def asset(group_name, name, yaw=-18, pitch=6):
    def deco(fn):
        REG[name] = (group_name, fn, yaw, pitch)
        return fn
    return deco


def W(): return clay(WHITE)
def K(): return clay(INK, 0.55, 0.05)
def G(): return clay(GREEN)
def M(): return clay(MENTHE)
def BR(): return clay(BRUME)
def LM(): return clay(LIMON)
def GR(): return clay(GREY)
def SCREEN(): return clay('#1d2027', 0.3, 0.0)
def GLOW(): return gloss(GREEN, 0.3, 0.0, emit=1.0)


def slab(poly, mat, H=0.28, BS=0.28, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, step=0.06):
    return blob(poly, mat, H, BS, loc, rot, parent, step)


def check(p, x, y, z, s, mat, r=0.1):
    return polyline_tube([(x - 0.42 * s, y, z + 0.0), (x - 0.14 * s, y, z - 0.3 * s), (x + 0.5 * s, y, z + 0.42 * s)], r * s, mat, p)


def arc_pts(cx, cz, r, a0, a1, n=9, y=0.0):
    out = []
    for i in range(n):
        a = math.radians(a0 + (a1 - a0) * i / (n - 1))
        out.append((cx + r * math.cos(a), y, cz + r * math.sin(a)))
    return out


# ================================================================= mascot
TRI = [(0, 2.6), (-2.1, -1.0), (2.1, -1.0)]


def mascot(p, color=GREEN, glasses='round', closed=False, headset=False, smile=False):
    poly = rpoly(TRI, 0.55)
    B = Blob(poly, H=0.95, BS=1.05, step=0.07)
    B.build(clay(color), parent=p, sub=1)
    ink = clay(INK, 0.55, 0.05)
    yfront = lambda x, z: -(B.height(x, z)) - 0.02
    ex, ez = 0.5, 0.3
    if glasses == 'round':
        for s in (-1, 1):
            x = s * ex
            torus(0.36, 0.04, (x, yfront(x, ez) - 0.06, ez), ink, rot=(90, 0, 0), parent=p)
        cyl(0.03, 2 * ex - 0.72 + 0.08, (0, yfront(0, ez + 0.1) - 0.06, ez + 0.1), ink, rot=(0, 90, 0), parent=p, bev=0.01)
    elif glasses == 'square':
        for s in (-1, 1):
            x = s * ex
            ring = rrect(0.74, 0.58, 0.14).difference(rrect(0.58, 0.42, 0.1))
            blob(ring, ink, H=0.045, BS=0.045, loc=(x, yfront(x, ez) - 0.04, ez), parent=p, step=0.03)
        cyl(0.03, 2 * ex - 0.74 + 0.08, (0, yfront(0, ez + 0.1) - 0.06, ez + 0.1), ink, rot=(0, 90, 0), parent=p, bev=0.01)
    ey = min(yfront(-ex, ez), yfront(ex, ez)) - 0.02
    eye_pair(p, ey, ez, dx=ex, closed=closed)
    if headset:
        tube([(-1.25, 0.0, 0.5), (-1.25, -0.25, 1.35), (0, -0.4, 1.95), (1.25, -0.25, 1.35), (1.25, 0.0, 0.5)], 0.06, ink, p)
        for s in (-1, 1):
            cyl(0.26, 0.24, (s * 1.25, 0.0, 0.4), ink, rot=(0, 90, 0), parent=p, bev=0.05)
        tube([(1.25, 0.0, 0.2), (1.0, -0.6, -0.1), (0.4, -0.95, -0.2)], 0.035, ink, p)
        sphere(0.1, (0.4, -0.95, -0.2), ink, parent=p)
    return B


def mini(root, loc=(0, 0, 0), s=0.5, **kw):
    g = group(loc=loc, scale=s, parent=root)
    mascot(g, **kw)
    return g


# ================================================================= core set
def puzzle_poly(knobs=('r', 't'), sockets=('l', 'b'), w=1.5, kr=0.3):
    h = w / 2

    def knob(side, inward=False):
        c = h - 0.2 if inward else h + 0.2
        rr = kr + (0.02 if inward else 0.0)
        if side == 'r':
            return union(sbox(h - 0.02 if not inward else h - 0.2, -0.12, h + 0.15 if not inward else h + 0.02, 0.12), circ(rr, c, 0))
        if side == 'l':
            return union(sbox(-h - 0.15 if not inward else -h - 0.02, -0.12, -h + 0.02 if not inward else -h + 0.2, 0.12), circ(rr, -c, 0))
        if side == 't':
            return union(sbox(-0.12, h - 0.02 if not inward else h - 0.2, 0.12, h + 0.15 if not inward else h + 0.02), circ(rr, 0, c))
        if side == 'b':
            return union(sbox(-0.12, -h - 0.15 if not inward else -h - 0.02, 0.12, -h + 0.02 if not inward else -h + 0.2), circ(rr, 0, -c))
    shape = union(rrect(w, w, 0.1), *[knob(k) for k in knobs])
    for s in sockets:
        shape = shape.difference(knob(s, True))
    return soften(rounded(shape, 0.04), 0.03)


@asset('core', 'puzzle_piece')
def _(root):
    slab(puzzle_poly(('r', 't'), ('l', 'b')), G(), H=0.34, BS=0.34, parent=root, step=0.05)


@asset('core', 'puzzle_pieces_joined')
def _(root):
    slab(puzzle_poly(('r',), ('l',)), W(), H=0.34, BS=0.34, loc=(-0.78, 0, 0), parent=root, step=0.05)
    slab(puzzle_poly(('t',), ('l',)), G(), H=0.34, BS=0.34, loc=(0.78, 0, 0.0), parent=root, step=0.05)


def prompt_marks(g, x, y, z, s=1.0):
    tube([(x - 0.35 * s, y, z + 0.3 * s), (x - 0.02 * s, y, z), (x - 0.35 * s, y, z - 0.3 * s)], 0.055 * s, GLOW(), g)
    polyline_tube([(x + 0.1 * s, y, z - 0.3 * s), (x + 0.6 * s, y, z - 0.3 * s)], 0.055 * s, GLOW(), g)


@asset('core', 'computer_laptop', yaw=-24, pitch=10)
def _(root):
    g = group(scale=0.9, parent=root)
    box((2.5, 1.7, 0.14), (0, 0, 0), W(), r=0.06, parent=g)
    box((2.1, 0.8, 0.03), (0, 0.2, 0.08), GR(), r=0.012, parent=g, sub=1)
    box((0.8, 0.4, 0.03), (0, -0.5, 0.08), GR(), r=0.01, parent=g, sub=1)
    sg = group(loc=(0, 0.8, 0.07), rot=(-14, 0, 0), parent=g)
    box((2.5, 0.12, 1.7), (0, 0, 0.88), W(), r=0.07, parent=sg)
    box((2.2, 0.03, 1.4), (0, -0.07, 0.9), SCREEN(), r=0.02, parent=sg, sub=1)
    prompt_marks(sg, -0.2, -0.1, 0.95, 1.1)


@asset('core', 'computer_desktop', yaw=-20, pitch=6)
def _(root):
    g = group(scale=0.9, parent=root)
    box((2.8, 0.22, 1.8), (0, 0, 1.45), W(), r=0.1, parent=g)
    box((2.5, 0.03, 1.5), (0, -0.12, 1.47), SCREEN(), r=0.02, parent=g, sub=1)
    prompt_marks(g, -0.2, -0.15, 1.5, 1.2)
    cyl(0.14, 0.75, (0, 0.05, 0.4), W(), parent=g)
    cyl(0.75, 0.12, (0, 0.05, 0.0), W(), parent=g)


@asset('core', 'code_brackets', yaw=-14, pitch=4)
def _(root):
    k = K(); gm = G()
    tube([(-0.75, 0, 0.8), (-1.5, 0, 0.0), (-0.75, 0, -0.8)], 0.2, gm, root)
    tube([(0.38, 0, 1.0), (-0.38, 0, -1.0)], 0.2, k, root)
    tube([(0.75, 0, 0.8), (1.5, 0, 0.0), (0.75, 0, -0.8)], 0.2, gm, root)


def cursor_poly():
    pts = [(-0.55, 1.2), (-0.55, -0.9), (-0.17, -0.55), (0.12, -1.25), (0.45, -1.1), (0.16, -0.45), (0.65, -0.45)]
    return rounded(soften(Polygon(pts), 0.07), 0.05)


@asset('core', 'cursor_arrow', yaw=-14, pitch=4)
def _(root):
    poly = cursor_poly()
    slab(poly.buffer(0.12), K(), H=0.24, BS=0.24, loc=(0, 0.06, 0), parent=root, step=0.045)
    slab(poly, W(), H=0.3, BS=0.3, loc=(0, -0.08, 0), parent=root, step=0.04)


def hand_poly():
    finger = rrect(0.4, 1.4, 0.2, -0.2, 0.55)
    palm = rrect(1.35, 1.0, 0.3, 0.1, -0.55)
    f2 = rrect(0.34, 0.6, 0.17, 0.32, -0.05)
    f3 = rrect(0.32, 0.55, 0.16, 0.62, -0.1)
    f4 = rrect(0.3, 0.5, 0.15, 0.88, -0.2)
    thumb = rotate2(rrect(0.4, 0.6, 0.2, -0.65, -0.5), 35)
    return soften(rounded(union(finger, palm, f2, f3, f4, thumb), 0.05), 0.03)


@asset('core', 'cursor_hand', yaw=-14, pitch=4)
def _(root):
    poly = hand_poly()
    slab(poly.buffer(0.1), K(), H=0.26, BS=0.26, loc=(0, 0.06, 0), parent=root, step=0.045)
    slab(poly, W(), H=0.32, BS=0.32, loc=(0, -0.08, 0), parent=root, step=0.04)


def keycap(p, label, w=1.4, loc=(0, 0, 0), color=WHITE, txt=INK, size=0.34, h=1.4):
    g = group(loc=loc, parent=p)
    box((w, h, 0.3), (0, 0, 0.15), clay(color), r=0.1, parent=g)
    box((w - 0.28, h - 0.28, 0.32), (0, 0, 0.38), clay(color), r=0.14, parent=g)
    if label:
        text(label, size * 0.8, (0, 0, 0.55), clay(txt, 0.55, 0.05), depth=0.03, rot=(0, 0, 0), parent=g, bevel=0.005)
    return g


KEY_PITCH = 42


@asset('core', 'key_enter', yaw=-22, pitch=KEY_PITCH)
def _(root):
    keycap(root, 'enter', 2.2, color=GREEN, size=0.34)


@asset('core', 'key_esc', yaw=-22, pitch=KEY_PITCH)
def _(root):
    keycap(root, 'esc', 1.4, color=INK, txt=WHITE, size=0.4)


@asset('core', 'key_space', yaw=-22, pitch=KEY_PITCH)
def _(root):
    keycap(root, '', 3.6, color=WHITE)


@asset('core', 'key_command', yaw=-22, pitch=KEY_PITCH)
def _(root):
    keycap(root, 'cmd', 1.5, color=WHITE, size=0.4)


@asset('core', 'key_shift', yaw=-22, pitch=KEY_PITCH)
def _(root):
    keycap(root, 'shift', 2.2, color=WHITE, size=0.4)


@asset('core', 'key_tab', yaw=-22, pitch=KEY_PITCH)
def _(root):
    keycap(root, 'tab', 1.8, color=MENTHE, size=0.4)


@asset('core', 'key_arrows', yaw=-22, pitch=KEY_PITCH)
def _(root):
    tri = rpoly([(0, 0.25), (-0.22, -0.15), (0.22, -0.15)], 0.05)
    spots = [('up', 0, 0.5, 0), ('left', -1.0, -0.5, 90), ('down', 0, -0.5, 180), ('right', 1.0, -0.5, -90)]
    for k, x, y, r in spots:
        g = keycap(root, '', 0.95, loc=(x, y, 0), color=WHITE, h=0.95)
        t = rotate2(scale2(tri, 1.5), r)
        blob(t, K(), H=0.04, BS=0.04, loc=(0, 0, 0.62), rot=(-90, 0, 0), parent=g, step=0.03)


@asset('core', 'keyboard_small', yaw=-20, pitch=48)
def _(root):
    box((5.8, 2.5, 0.22), (0, 0, 0.0), K(), r=0.1, parent=root)
    rows = [(0.85, 11, -2.5), (0.35, 11, -2.5), (-0.15, 10, -2.3)]
    import random
    random.seed(3)
    for y, n, x0 in rows:
        for i in range(n):
            c = GREEN if random.random() < 0.12 else WHITE
            box((0.42, 0.42, 0.18), (x0 + i * 0.5, y, 0.18), clay(c), r=0.07, parent=root, sub=1)
    box((2.6, 0.42, 0.18), (-0.6, -0.68, 0.18), W(), r=0.07, parent=root, sub=1)
    box((1.0, 0.42, 0.18), (1.2, -0.68, 0.18), clay(GREEN), r=0.07, parent=root, sub=1)
    for i in range(3):
        box((0.42, 0.42, 0.18), (1.95 + i * 0.5, -0.68, 0.18), W(), r=0.07, parent=root, sub=1)


# ================================================================= agents
@asset('agents', 'mini_mascot_round', yaw=-12, pitch=5)
def _(root):
    mini(root, s=0.55, glasses='round')


@asset('agents', 'mini_mascot_square', yaw=-12, pitch=5)
def _(root):
    mini(root, s=0.55, glasses='square', color=MENTHE)


@asset('agents', 'mini_mascot_plain', yaw=-12, pitch=5)
def _(root):
    mini(root, s=0.55, glasses='none', color=WHITE)


@asset('agents', 'mini_mascot_headset', yaw=-12, pitch=5)
def _(root):
    mini(root, s=0.55, glasses='round', headset=True)


@asset('agents', 'mascot_with_puzzle', yaw=-14, pitch=5)
def _(root):
    mini(root, loc=(-0.5, 0, 0.1), s=0.5)
    slab(puzzle_poly(('r', 't'), ('l', 'b')), MENTHE and M(), H=0.3, BS=0.3, loc=(1.45, -0.35, -0.2), rot=(0, 0, -14), parent=root, step=0.05)


@asset('agents', 'mascot_on_cursor', yaw=-16, pitch=6)
def _(root):
    g = group(scale=1.3, parent=root)
    poly = cursor_poly()
    slab(poly.buffer(0.12), K(), H=0.24, BS=0.24, loc=(0, 0.06, 0), parent=g, step=0.045)
    slab(poly, W(), H=0.3, BS=0.3, loc=(0, -0.08, 0), parent=g, step=0.04)
    mini(root, loc=(1.05, -0.45, 0.35), s=0.28)


@asset('agents', 'mascot_at_laptop', yaw=-16, pitch=8)
def _(root):
    mini(root, loc=(0, 1.6, 0.95), s=0.5)
    g = group(scale=0.9, loc=(0, -0.2, -0.65), parent=root)
    box((2.5, 1.7, 0.14), (0, 0, 0), W(), r=0.06, parent=g)
    sg = group(loc=(0, 0.8, 0.07), rot=(-14, 0, 0), parent=g)
    box((2.5, 0.12, 1.5), (0, 0, 0.78), W(), r=0.07, parent=sg)
    box((2.2, 0.03, 1.2), (0, -0.07, 0.8), SCREEN(), r=0.02, parent=sg, sub=1)
    prompt_marks(sg, -0.2, -0.1, 0.85, 1.0)


def bubble_poly(w=2.6, h=1.7):
    body = rrect(w, h, 0.6)
    tail = Polygon([(-1.0, -0.4), (-0.15, -0.85), (-1.25, -1.45)])
    return soften(rounded(union(body, tail), 0.08), 0.04)


@asset('agents', 'chat_bubble_working', yaw=-14, pitch=4)
def _(root):
    slab(bubble_poly(), W(), H=0.36, BS=0.36, parent=root, step=0.055)
    for x in (-0.65, 0, 0.65):
        sphere(0.17, (x, -0.4, 0.0), K(), parent=root)


@asset('agents', 'chat_bubble_done', yaw=-14, pitch=4)
def _(root):
    slab(bubble_poly(), G(), H=0.36, BS=0.36, parent=root, step=0.055)
    check(root, 0, -0.46, 0.0, 1.5, clay(WHITE), 0.1)


@asset('agents', 'checkmark_badge', yaw=-14, pitch=4)
def _(root):
    slab(circ(1.2), K(), H=0.5, BS=0.5, parent=root, step=0.06)
    check(root, 0, -0.58, 0.0, 1.8, clay(WHITE), 0.12)


@asset('agents', 'play_button', yaw=-14, pitch=4)
def _(root):
    slab(circ(1.2), W(), H=0.5, BS=0.5, parent=root, step=0.06)
    slab(rpoly([(-0.4, 0.62), (-0.4, -0.62), (0.7, 0)], 0.15), G(), H=0.2, BS=0.2, loc=(0.06, -0.42, 0), parent=root, step=0.04)


@asset('agents', 'pause_button', yaw=-14, pitch=4)
def _(root):
    slab(circ(1.2), W(), H=0.5, BS=0.5, parent=root, step=0.06)
    for x in (-0.28, 0.28):
        slab(rrect(0.3, 0.9, 0.14), K(), H=0.18, BS=0.18, loc=(x, -0.42, 0), parent=root, step=0.04)


@asset('agents', 'stop_button', yaw=-14, pitch=4)
def _(root):
    slab(circ(1.2), W(), H=0.5, BS=0.5, parent=root, step=0.06)
    slab(rrect(0.8, 0.8, 0.2), K(), H=0.2, BS=0.2, loc=(0, -0.42, 0), parent=root, step=0.04)


@asset('agents', 'loading_ring', yaw=-12, pitch=5)
def _(root):
    tube(arc_pts(0, 0, 1.1, 0, 360, 25), 0.2, clay(GREY), root, cyclic=True)
    tube(arc_pts(0, 0, 1.1, 80, 330, 17, y=-0.05), 0.22, G(), root)


@asset('agents', 'progress_bar', yaw=-12, pitch=5)
def _(root):
    slab(rrect(3.2, 0.7, 0.35), GR(), H=0.28, BS=0.28, parent=root, step=0.05)
    slab(rrect(2.0, 0.7, 0.35, -0.6, 0), G(), H=0.3, BS=0.3, loc=(0, -0.12, 0), parent=root, step=0.05)


@asset('agents', 'task_checklist', yaw=-14, pitch=5)
def _(root):
    slab(rrect(2.5, 3.1, 0.4), W(), H=0.3, BS=0.3, parent=root, step=0.06)
    for i, z in enumerate((0.9, 0.0, -0.9)):
        done = i < 2
        slab(circ(0.3), G() if done else GR(), H=0.12, BS=0.12, loc=(-0.75, -0.3, z), parent=root, step=0.04)
        if done:
            check(root, -0.75, -0.46, z, 0.5, clay(WHITE), 0.1)
        polyline_tube([(-0.25, -0.34, z), (0.85, -0.34, z)], 0.07, K() if done else GR(), root)


@asset('agents', 'agent_badge', yaw=-14, pitch=5)
def _(root):
    slab(rrect(2.0, 2.9, 0.4), K(), H=0.3, BS=0.3, parent=root, step=0.06)
    slab(rrect(0.8, 0.16, 0.08), W(), H=0.08, BS=0.08, loc=(0, -0.3, 1.1), parent=root, step=0.03)
    mini(root, loc=(0, -0.45, 0.15), s=0.3)
    polyline_tube([(-0.6, -0.36, -0.75), (0.6, -0.36, -0.75)], 0.06, clay(WHITE), root)
    polyline_tube([(-0.6, -0.36, -1.05), (0.1, -0.36, -1.05)], 0.06, M(), root)


@asset('agents', 'handoff_arrow', yaw=-10, pitch=5)
def _(root):
    mini(root, loc=(-1.6, 0, -0.5), s=0.4)
    mini(root, loc=(1.6, 0, -0.5), s=0.4, color=WHITE, glasses='square')
    tube([(-1.5, 0, 0.8), (-0.7, 0, 1.45), (0.7, 0, 1.45), (1.45, 0, 0.9)], 0.11, G(), root)
    cone(0.26, 0.0, 0.5, (1.5, 0, 0.78), G(), rot=(180, 0, -25), parent=root, bev=0.04)


@asset('agents', 'magnifying_glass', yaw=-14, pitch=6)
def _(root):
    torus(0.85, 0.15, (-0.2, 0, 0.25), K(), rot=(90, 0, 0), parent=root)
    cyl(0.8, 0.06, (-0.2, 0.02, 0.25), clay(BRUME), rot=(90, 0, 0), parent=root, bev=0.03)
    cyl(0.17, 1.5, (0.95, 0, -0.95), G(), rot=(0, 135, 0), parent=root, bev=0.07)


@asset('agents', 'lightbulb', yaw=-14, pitch=5)
def _(root):
    sphere(0.95, (0, 0, 0.45), LM(), scale=(1, 1, 1.05), parent=root)
    cone(0.5, 0.75, 0.5, (0, 0, -0.55), LM(), parent=root, bev=0.04)
    cyl(0.5, 0.6, (0, 0, -1.0), GR(), parent=root, bev=0.05)
    for z in (-0.82, -1.0, -1.18):
        torus(0.5, 0.05, (0, 0, z), K(), parent=root)
    sphere(0.2, (0, 0, -1.45), K(), parent=root)
    for a in (35, 90, 145):
        r0, r1 = 1.35, 1.75
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        polyline_tube([(r0 * ca, 0, 0.45 + r0 * sa), (r1 * ca, 0, 0.45 + r1 * sa)], 0.07, G(), root)


@asset('agents', 'sparkle_swirl', yaw=-12, pitch=4)
def _(root):
    pts = []
    n = 34
    for i in range(n):
        t = i / (n - 1)
        a = t * math.pi * 2 * 2.3
        r = 0.12 + 1.15 * t
        pts.append((r * math.cos(a), 0, r * math.sin(a)))
    tube(pts, 0.14, G(), root)
    sphere(0.2, pts[0], K(), parent=root)
    sphere(0.2, pts[-1], M(), parent=root)


# ================================================================= hardware
@asset('hardware', 'chip', yaw=-22, pitch=48)
def _(root):
    box((2.2, 2.2, 0.32), (0, 0, 0.16), W(), r=0.2, parent=root)
    box((1.2, 1.2, 0.34), (0, 0, 0.3), G(), r=0.2, parent=root)
    for i in range(5):
        v = -0.8 + i * 0.4
        for s in (-1, 1):
            box((0.22, 0.5, 0.14), (v, s * 1.28, 0.14), K(), r=0.05, parent=root, sub=1)
            box((0.5, 0.22, 0.14), (s * 1.28, v, 0.14), K(), r=0.05, parent=root, sub=1)


@asset('hardware', 'server_stack', yaw=-22, pitch=12)
def _(root):
    for i, z in enumerate((-0.78, 0.0, 0.78)):
        box((2.4, 1.5, 0.64), (0, 0, z), W(), r=0.16, parent=root)
        box((1.2, 0.04, 0.12), (-0.35, -0.76, z + 0.12), K(), r=0.02, parent=root, sub=1)
        box((1.2, 0.04, 0.12), (-0.35, -0.76, z - 0.12), K(), r=0.02, parent=root, sub=1)
        sphere(0.09, (0.85, -0.77, z), G() if i != 1 else M(), parent=root)


@asset('hardware', 'database', yaw=-18, pitch=18)
def _(root):
    for z in (-0.8, 0.0, 0.8):
        cyl(1.05, 0.62, (0, 0, z), W(), parent=root, bev=0.12)
        cyl(1.08, 0.1, (0, 0, z + 0.2), G() if z > 0 else M(), parent=root, bev=0.03)


@asset('hardware', 'phone', yaw=-20, pitch=6)
def _(root):
    box((1.3, 0.22, 2.5), (0, 0, 0), K(), r=0.22, parent=root)
    box((1.1, 0.05, 2.3), (0, -0.11, 0), W(), r=0.12, parent=root, sub=1)
    box((0.35, 0.04, 0.09), (0, -0.14, 1.0), K(), r=0.03, parent=root, sub=1)
    box((0.7, 0.04, 0.3), (-0.1, -0.14, 0.4), G(), r=0.12, parent=root, sub=1)
    box((0.7, 0.04, 0.3), (0.1, -0.14, -0.1), GR(), r=0.12, parent=root, sub=1)
    box((0.6, 0.04, 0.3), (-0.12, -0.14, -0.6), M(), r=0.12, parent=root, sub=1)


@asset('hardware', 'tablet', yaw=-20, pitch=6)
def _(root):
    box((2.7, 0.22, 1.95), (0, 0, 0), K(), r=0.22, parent=root)
    box((2.45, 0.05, 1.7), (0, -0.11, 0), W(), r=0.12, parent=root, sub=1)
    box((1.0, 0.04, 0.4), (-0.55, -0.14, 0.45), G(), r=0.12, parent=root, sub=1)
    box((1.6, 0.04, 0.3), (-0.2, -0.14, -0.1), GR(), r=0.12, parent=root, sub=1)
    box((0.9, 0.04, 0.3), (-0.55, -0.14, -0.55), M(), r=0.12, parent=root, sub=1)


@asset('hardware', 'router', yaw=-22, pitch=22)
def _(root):
    box((2.5, 1.3, 0.38), (0, 0, 0), W(), r=0.16, parent=root)
    for x in (-0.95, 0.95):
        cyl(0.075, 1.4, (x, 0.45, 0.85), K(), rot=(0, 0, 0), parent=root, bev=0.03)
        sphere(0.1, (x, 0.45, 1.55), K(), parent=root)
    for i, x in enumerate((-0.4, 0.0, 0.4)):
        sphere(0.07, (x, -0.66, 0.02), G() if i != 2 else M(), parent=root)


@asset('hardware', 'battery', yaw=-18, pitch=8)
def _(root):
    box((2.5, 0.8, 1.2), (0, 0, 0), W(), r=0.3, parent=root)
    box((0.28, 0.5, 0.5), (1.4, 0, 0), K(), r=0.1, parent=root)
    for x in (-0.8, -0.1, 0.6):
        box((0.5, 0.06, 0.72), (x, -0.4, 0), G(), r=0.12, parent=root, sub=1)


@asset('hardware', 'usb_drive', yaw=-24, pitch=10)
def _(root):
    box((1.1, 0.5, 1.6), (0, 0, -0.35), G(), r=0.25, parent=root)
    box((0.7, 0.24, 0.9), (0, 0, 0.75), GR(), r=0.07, parent=root, sub=1)
    for s in (-1, 1):
        box((0.1, 0.05, 0.3), (s * 0.18, -0.13, 0.8), K(), r=0.02, parent=root, sub=1)
    torus(0.17, 0.06, (0, 0, -1.2), K(), rot=(90, 0, 0), parent=root)


@asset('hardware', 'mouse', yaw=-20, pitch=40)
def _(root):
    sphere(1.0, (0, 0, 0), W(), scale=(0.8, 1.3, 0.62), parent=root)
    cyl(0.11, 0.36, (0, -0.5, 0.55), K(), rot=(0, 90, 0), parent=root, bev=0.04)
    tube([(0, -0.0, 0.62), (0, -0.7, 0.5), (0, -0.95, 0.3)], 0.025, K(), root)
    tube([(-0.62, -0.1, 0.35), (0, -0.05, 0.6), (0.62, -0.1, 0.35)], 0.025, K(), root)
    sphere(0.12, (0, 0.95, 0.15), G(), parent=root)


@asset('hardware', 'headphones', yaw=-12, pitch=5)
def _(root):
    tube([(-1.2, 0, -0.2), (-1.0, 0, 0.75), (0, 0, 1.25), (1.0, 0, 0.75), (1.2, 0, -0.2)], 0.13, K(), root)
    for s in (-1, 1):
        cyl(0.55, 0.42, (s * 1.25, 0, -0.35), G(), rot=(0, 90, 0), parent=root, bev=0.1)
        cyl(0.48, 0.16, (s * 1.0, 0, -0.35), W(), rot=(0, 90, 0), parent=root, bev=0.06)


# ================================================================= interface
def window(root, title_color=INK):
    slab(rrect(3.4, 2.4, 0.4), W(), H=0.32, BS=0.32, parent=root, step=0.06)
    for i, c in enumerate((INK, MENTHE, GREEN)):
        sphere(0.1, (-1.35 + i * 0.28, -0.34, 0.92), clay(c), parent=root)
    slab(rrect(3.0, 1.55, 0.2), SCREEN(), H=0.1, BS=0.1, loc=(0, -0.3, -0.3), parent=root, step=0.05)


@asset('interface', 'terminal_window', yaw=-16, pitch=5)
def _(root):
    window(root)
    prompt_marks(root, -0.9, -0.5, -0.2, 0.9)
    box((0.22, 0.05, 0.45), (0.3, -0.5, -0.5), clay(GREEN), r=0.03, parent=root, sub=1)
    polyline_tube([(-1.3, -0.45, -0.65), (-0.3, -0.45, -0.65)], 0.04, gloss(MENTHE, 0.3, 0, 0.8), root)


@asset('interface', 'browser_window', yaw=-16, pitch=5)
def _(root):
    slab(rrect(3.4, 2.4, 0.4), W(), H=0.32, BS=0.32, parent=root, step=0.06)
    for i, c in enumerate((INK, MENTHE, GREEN)):
        sphere(0.1, (-1.35 + i * 0.28, -0.34, 0.92), clay(c), parent=root)
    slab(rrect(2.1, 0.34, 0.17), GR(), H=0.1, BS=0.1, loc=(0.35, -0.3, 0.9), parent=root, step=0.04)
    slab(rrect(3.0, 1.5, 0.2), clay('#eceeed'), H=0.08, BS=0.08, loc=(0, -0.3, -0.35), parent=root, step=0.05)
    slab(rrect(1.2, 0.8, 0.16), G(), H=0.1, BS=0.1, loc=(-0.7, -0.38, -0.3), parent=root, step=0.04)
    slab(rrect(0.9, 0.3, 0.12), M(), H=0.1, BS=0.1, loc=(0.55, -0.38, -0.1), parent=root, step=0.04)
    slab(rrect(0.9, 0.3, 0.12), GR(), H=0.1, BS=0.1, loc=(0.55, -0.38, -0.55), parent=root, step=0.04)


@asset('interface', 'toggle_on', yaw=-12, pitch=5)
def _(root):
    slab(rrect(2.5, 1.3, 0.65), G(), H=0.5, BS=0.5, parent=root, step=0.05)
    sphere(0.5, (0.6, -0.45, 0), W(), parent=root)


@asset('interface', 'toggle_off', yaw=-12, pitch=5)
def _(root):
    slab(rrect(2.5, 1.3, 0.65), GR(), H=0.5, BS=0.5, parent=root, step=0.05)
    sphere(0.5, (-0.6, -0.45, 0), W(), parent=root)


@asset('interface', 'slider', yaw=-12, pitch=5)
def _(root):
    slab(rrect(3.2, 0.5, 0.25), GR(), H=0.22, BS=0.22, parent=root, step=0.05)
    slab(rrect(1.9, 0.5, 0.25, -0.65, 0), G(), H=0.25, BS=0.25, loc=(0, -0.08, 0), parent=root, step=0.05)
    sphere(0.42, (0.3, -0.3, 0), W(), parent=root)
    sphere(0.16, (0.3, -0.68, 0), G(), parent=root)


@asset('interface', 'checkbox', yaw=-12, pitch=5)
def _(root):
    slab(rrect(1.8, 1.8, 0.5), G(), H=0.5, BS=0.5, parent=root, step=0.05)
    check(root, 0, -0.55, 0.0, 1.5, clay(WHITE), 0.12)


@asset('interface', 'radio_button', yaw=-12, pitch=5)
def _(root):
    slab(circ(1.0), W(), H=0.5, BS=0.5, parent=root, step=0.05)
    sphere(0.42, (0, -0.4, 0), G(), parent=root)


@asset('interface', 'folder', yaw=-16, pitch=6)
def _(root):
    back = union(rrect(2.7, 1.8, 0.3, 0, -0.1), rrect(1.1, 0.6, 0.22, -0.8, 0.85))
    slab(soften(back, 0.05), G(), H=0.3, BS=0.3, parent=root, step=0.05)
    slab(rrect(2.7, 1.45, 0.3, 0, -0.3), W(), H=0.3, BS=0.3, loc=(0, -0.28, 0), parent=root, step=0.05)


@asset('interface', 'file_page', yaw=-16, pitch=6)
def _(root):
    poly = rpoly([(-0.9, -1.15), (0.9, -1.15), (0.9, 0.5), (0.25, 1.15), (-0.9, 1.15)], 0.12)
    slab(poly, W(), H=0.26, BS=0.26, parent=root, step=0.05)
    slab(rpoly([(0.25, 1.15), (0.9, 0.5), (0.25, 0.5)], 0.06), G(), H=0.14, BS=0.14, loc=(0, -0.2, 0), parent=root, step=0.035)
    for z, w in ((0.0, 0.6), (-0.35, 0.6), (-0.7, 0.35)):
        polyline_tube([(-0.55, -0.3, z), (-0.55 + 2 * w * 0.9, -0.3, z)], 0.055, K(), root)


@asset('interface', 'trash_can', yaw=-18, pitch=10)
def _(root):
    cone(0.6, 0.82, 1.55, (0, 0, 0), W(), parent=root, bev=0.1)
    cyl(1.0, 0.17, (0, 0, 0.88), K(), parent=root, bev=0.06)
    torus(0.22, 0.055, (0, 0, 1.08), K(), rot=(90, 0, 0), parent=root)
    for x in (-0.3, 0, 0.3):
        polyline_tube([(x, -0.78 + abs(x) * 0.0, 0.45), (x * 0.85, -0.66, -0.5)], 0.045, K(), root)


def gear_poly():
    body = circ(0.86)
    teeth = [rotate2(sbox(-0.2, 0.7, 0.2, 1.2), k * 45) for k in range(8)]
    shape = union(body, *teeth)
    return soften(rounded(shape, 0.06), 0.05).difference(circ(0.36))


@asset('interface', 'settings_gear', yaw=-14, pitch=4)
def _(root):
    slab(gear_poly(), G(), H=0.34, BS=0.3, parent=root, step=0.05)


@asset('interface', 'notification_bell', yaw=-14, pitch=5)
def _(root):
    bell = union(circ(0.8, 0, 0.35), rpoly([(-0.8, 0.35), (0.8, 0.35), (1.2, -0.6), (-1.2, -0.6)], 0.18), rrect(2.6, 0.34, 0.17, 0, -0.65))
    slab(soften(rounded(bell, 0.08), 0.05), W(), H=0.5, BS=0.5, parent=root, step=0.05)
    sphere(0.28, (0, -0.1, -1.0), K(), parent=root)
    sphere(0.3, (0.8, -0.6, 1.0), G(), parent=root)


@asset('interface', 'location_pin', yaw=-14, pitch=5)
def _(root):
    pin = union(circ(0.95, 0, 0.45), Polygon([(-0.7, 0.0), (0.7, 0.0), (0, -1.35)]))
    slab(soften(rounded(pin, 0.12), 0.06), G(), H=0.5, BS=0.5, parent=root, step=0.05)
    sphere(0.38, (0, -0.55, 0.45), W(), parent=root)


# ================================================================= security
def shackle(root, open_=False):
    if not open_:
        pts = [(-0.55, 0, 0.3), (-0.55, 0, 0.65), (-0.3, 0, 1.05), (0, 0, 1.2), (0.3, 0, 1.05), (0.55, 0, 0.65), (0.55, 0, 0.3)]
    else:
        pts = [(-0.55, 0, 0.3), (-0.55, 0, 0.9), (-0.3, 0, 1.3), (0, 0, 1.45), (0.3, 0, 1.3), (0.55, 0, 1.0), (0.55, 0, 0.7)]
    tube(pts, 0.14, W(), root)


@asset('security', 'padlock_closed', yaw=-16, pitch=5)
def _(root):
    slab(rrect(2.0, 1.55, 0.4, 0, -0.45), G(), H=0.4, BS=0.4, parent=root, step=0.05)
    shackle(root)
    slab(circ(0.17, 0, -0.35), K(), H=0.1, BS=0.1, loc=(0, -0.42, 0), parent=root, step=0.03)
    slab(rrect(0.1, 0.4, 0.05, 0, -0.62), K(), H=0.1, BS=0.1, loc=(0, -0.42, 0), parent=root, step=0.03)


@asset('security', 'padlock_open', yaw=-16, pitch=5)
def _(root):
    slab(rrect(2.0, 1.55, 0.4, 0, -0.45), MENTHE and M(), H=0.4, BS=0.4, parent=root, step=0.05)
    shackle(root, True)
    slab(circ(0.17, 0, -0.35), K(), H=0.1, BS=0.1, loc=(0, -0.42, 0), parent=root, step=0.03)
    slab(rrect(0.1, 0.4, 0.05, 0, -0.62), K(), H=0.1, BS=0.1, loc=(0, -0.42, 0), parent=root, step=0.03)


def shield_poly(s=1.0):
    pts = [(-1.0, 1.0), (0, 1.3), (1.0, 1.0), (1.0, 0.0), (0.0, -1.45), (-1.0, 0.0)]
    return scale2(soften(rounded(Polygon(pts), 0.22), 0.12), s)


@asset('security', 'shield_check', yaw=-14, pitch=5)
def _(root):
    slab(shield_poly(1.05), W(), H=0.5, BS=0.5, parent=root, step=0.05)
    slab(shield_poly(0.62), G(), H=0.18, BS=0.18, loc=(0, -0.48, 0.0), parent=root, step=0.04)
    check(root, 0, -0.7, 0.0, 1.0, clay(WHITE), 0.1)


@asset('security', 'key', yaw=-14, pitch=6)
def _(root):
    g = group(rot=(0, -35, 0), parent=root)
    torus(0.55, 0.19, (-1.15, 0, 0), G(), rot=(90, 0, 0), parent=g)
    box((1.9, 0.26, 0.26), (0.6, 0, 0), W(), r=0.1, parent=g)
    box((0.24, 0.26, 0.5), (1.1, 0, -0.26), W(), r=0.08, parent=g, sub=1)
    box((0.24, 0.26, 0.4), (1.5, 0, -0.2), W(), r=0.08, parent=g, sub=1)


@asset('security', 'wifi', yaw=-12, pitch=4)
def _(root):
    sphere(0.24, (0, 0, -1.0), G(), parent=root)
    for r, c in ((0.8, M()), (1.35, K()), (1.9, M())):
        tube(arc_pts(0, -1.0, r, 48, 132, 9), 0.17, c, root)


def cloud_poly():
    c = union(circ(0.75, -0.8, -0.1), circ(0.98, 0.0, 0.3), circ(0.7, 0.95, -0.1), rrect(2.9, 0.85, 0.42, 0.05, -0.45))
    return soften(rounded(c, 0.12), 0.05)


@asset('security', 'cloud', yaw=-14, pitch=5)
def _(root):
    slab(cloud_poly(), W(), H=0.6, BS=0.6, parent=root, step=0.06)


@asset('security', 'cloud_upload', yaw=-14, pitch=5)
def _(root):
    slab(cloud_poly(), W(), H=0.6, BS=0.6, parent=root, step=0.06)
    arrow = rpoly([(0, 0.7), (0.62, 0.0), (0.24, 0.0), (0.24, -0.72), (-0.24, -0.72), (-0.24, 0.0), (-0.62, 0.0)], 0.07)
    slab(arrow, G(), H=0.18, BS=0.18, loc=(0, -0.62, -0.05), parent=root, step=0.035)


@asset('security', 'link_chain', yaw=-14, pitch=34)
def _(root):
    link = rrect(1.9, 0.9, 0.45).difference(rrect(1.2, 0.35, 0.18))
    slab(link, W(), H=0.2, BS=0.2, loc=(-0.55, 0, 0), parent=root, step=0.04)
    slab(link, G(), H=0.2, BS=0.2, loc=(0.35, 0, 0), rot=(90, 0, 0), parent=root, step=0.04)


@asset('security', 'plug', yaw=-26, pitch=14)
def _(root):
    box((1.3, 1.1, 1.1), (-0.3, 0, 0), K(), r=0.28, parent=root)
    for z in (-0.25, 0.25):
        cyl(0.1, 0.85, (0.65, 0, z), W(), rot=(0, 90, 0), parent=root, bev=0.04)
    tube([(-0.85, 0, 0), (-1.5, 0, -0.35), (-2.2, 0, -0.1)], 0.13, G(), root)


@asset('security', 'network_nodes', yaw=-14, pitch=5)
def _(root):
    nodes = [((0, 0, 0), 0.42, GREEN), ((-1.3, 0, 0.75), 0.28, WHITE), ((1.25, 0, 0.9), 0.3, INK), ((1.05, 0, -0.9), 0.26, WHITE), ((-1.15, 0, -0.85), 0.3, MENTHE)]
    for (p, r, c) in nodes[1:]:
        polyline_tube([(0, 0, 0), p], 0.05, K(), root)
    for (p, r, c) in nodes:
        sphere(r, p, clay(c), parent=root)


@asset('security', 'circuit_trace', yaw=-12, pitch=6)
def _(root):
    for dz, c in ((0.35, INK), (-0.35, MENTHE)):
        m = clay(c, 0.55, 0.05)
        pts = [(-1.6, 0, dz - 0.5), (-0.7, 0, dz - 0.5), (-0.2, 0, dz), (0.8, 0, dz), (1.3, 0, dz + 0.5)]
        polyline_tube(pts, 0.085, m, root)
        torus(0.2, 0.07, pts[0], m, rot=(90, 0, 0), parent=root)
        torus(0.2, 0.07, pts[-1], m, rot=(90, 0, 0), parent=root)


# ================================================================= shapes
@asset('shapes', 'swirl_menthe', yaw=-14, pitch=6)
def _(root):
    pts = []
    n = 40
    for i in range(n):
        t = i / (n - 1)
        a = t * math.pi * 2 * 3.2
        r = 1.15 - 0.65 * t
        pts.append((r * math.cos(a), r * math.sin(a), -1.4 + 2.8 * t))
    tube(pts, 0.24, M(), root)
    sphere(0.26, pts[-1], M(), parent=root)


@asset('shapes', 'swirl_black', yaw=-14, pitch=6)
def _(root):
    pts = []
    n = 40
    for i in range(n):
        t = i / (n - 1)
        a = t * math.pi * 2 * 3.2
        r = 1.15 - 0.65 * t
        pts.append((r * math.cos(a), r * math.sin(a), -1.4 + 2.8 * t))
    tube(pts, 0.24, K(), root)
    sphere(0.26, pts[-1], K(), parent=root)


@asset('shapes', 'pebble_set', yaw=-14, pitch=12)
def _(root):
    sphere(0.95, (-0.8, 0.0, -0.05), G(), scale=(1, 0.9, 0.82), parent=root)
    sphere(0.6, (0.55, -0.9, -0.3), K(), scale=(1, 0.9, 0.85), parent=root)
    sphere(0.42, (1.3, 0.1, -0.45), W(), scale=(1, 0.9, 0.85), parent=root)


@asset('shapes', 'donut_ring', yaw=-14, pitch=20)
def _(root):
    torus(1.0, 0.45, (-0.2, 0, 0), G(), rot=(90, 0, 0), parent=root)
    torus(0.55, 0.22, (1.05, 0.1, -0.55), K(), rot=(90, 0, 0), parent=root)


@asset('shapes', 'squiggle_worm', yaw=-10, pitch=5)
def _(root):
    pts = [(-1.6 + i * 0.53, 0, 0.5 * math.sin(i * 1.15)) for i in range(7)]
    tube(pts, 0.2, M(), root)


@asset('shapes', 'tiny_triangles', yaw=-10, pitch=5)
def _(root):
    base = rpoly([(0, 1.0), (-0.95, -0.6), (0.95, -0.6)], 0.2)
    slab(rotate2(base, 10), G(), H=0.3, BS=0.3, loc=(-0.9, 0, 0.2), parent=root, step=0.05)
    slab(scale2(rotate2(base, -20), 0.65), K(), H=0.22, BS=0.22, loc=(0.7, -0.15, 0.7), parent=root, step=0.04)
    slab(scale2(rotate2(base, 25), 0.5), W(), H=0.2, BS=0.2, loc=(0.9, 0.0, -0.6), parent=root, step=0.04)


@asset('shapes', 'soft_puddle', yaw=-14, pitch=34)
def _(root):
    p = union(circ(1.1, 0, 0), circ(0.7, 1.1, 0.2), circ(0.55, -1.0, 0.3), circ(0.45, 0.4, -0.85))
    slab(soften(rounded(p, 0.3), 0.15), M(), H=0.16, BS=0.16, rot=(-90, 0, 0), parent=root, step=0.06)
    sphere(0.3, (0.1, 0, 0.7), M(), scale=(1, 1, 1.25), parent=root)


# ================================================================= mascot poses
def gear_small(root, loc, s, mat, rot=0):
    slab(rotate2(scale2(gear_poly(), s), rot), mat, H=0.18, BS=0.17, loc=loc, parent=root, step=0.04)


@asset('mascot', 'mascot_welcome', yaw=-12, pitch=5)
def _(root):
    mini(root, s=0.55, smile=True)


@asset('mascot', 'mascot_working', yaw=-14, pitch=5)
def _(root):
    mini(root, loc=(-0.5, 0, 0), s=0.5)
    gear_small(root, (1.5, -0.35, 0.65), 0.6, K())
    gear_small(root, (1.95, -0.35, -0.15), 0.4, M(), 20)


@asset('mascot', 'mascot_success', yaw=-14, pitch=5)
def _(root):
    mini(root, loc=(-0.4, 0, 0), s=0.5, smile=True)
    slab(circ(0.62), K(), H=0.3, BS=0.3, loc=(1.45, -0.3, 0.95), parent=root, step=0.05)
    check(root, 1.45, -0.6, 0.95, 0.8, clay(WHITE), 0.1)


@asset('mascot', 'mascot_error', yaw=-14, pitch=5)
def _(root):
    mini(root, loc=(-0.4, 0, 0), s=0.5)
    slab(rrect(0.5, 1.3, 0.25), K(), H=0.22, BS=0.22, loc=(1.5, -0.2, 0.7), parent=root, step=0.04)
    sphere(0.27, (1.5, -0.25, -0.35), K(), parent=root)


@asset('mascot', 'mascot_thinking', yaw=-12, pitch=5)
def _(root):
    mini(root, loc=(-0.5, 0, -0.1), s=0.5)
    sphere(0.1, (0.75, -0.1, 0.9), W(), parent=root)
    sphere(0.17, (1.05, -0.1, 1.2), W(), parent=root)
    slab(scale2(cloud_poly(), 0.5), W(), H=0.22, BS=0.22, loc=(1.6, -0.1, 1.75), parent=root, step=0.04)
    for x in (-0.33, 0, 0.33):
        sphere(0.07, (1.6 + x, -0.35, 1.75), K(), parent=root)


@asset('mascot', 'mascot_waiting', yaw=-14, pitch=5)
def _(root):
    mini(root, loc=(-0.5, 0, 0), s=0.5)
    tube([(-0.35, 0, 0.55), (-0.2, 0, 1.0), (0.3, 0, 1.05), (0.5, 0, 0.6), (0.25, 0, 0.15), (0.0, 0, -0.25)], 0.13, M(), root, loc=(1.6, -0.2, 0.3))
    sphere(0.16, (1.6, -0.2, -0.45), M(), parent=root)


@asset('mascot', 'mascot_sleeping', yaw=-12, pitch=5)
def _(root):
    g = group(loc=(-0.4, 0, 0), rot=(0, 0, 5), parent=root)
    mini(g, s=0.5, closed=True)
    for i, (x, z, sz) in enumerate(((1.0, 0.6, 0.5), (1.45, 1.1, 0.38), (1.8, 1.5, 0.28))):
        text('z', sz, (x, -0.1, z), K(), depth=0.1, bevel=0.03, parent=root)


@asset('mascot', 'mascot_waving', yaw=-12, pitch=5)
def _(root):
    g = group(loc=(-0.3, 0, 0), rot=(0, 0, -7), parent=root)
    mini(g, s=0.5, smile=True)
    for r in (0.5, 0.85):
        tube(arc_pts(1.15, 0.5, r, -40, 40, 7), 0.07, M(), root)
