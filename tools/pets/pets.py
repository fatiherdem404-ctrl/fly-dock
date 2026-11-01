# Turns the downloaded cat and dog models into sprite sheets for the desktop pets.
#
#   blender -b --factory-startup --python tools/pets/pets.py -- <dog|cat> <model.blend> <out dir> [only-animation] [size]
#
# 1. a bone rig is built from landmarks of the mesh and the mesh is weighted to it by distance (no hand painting),
# 2. every animation is a function of a phase 0..1 that sets bone transforms (rotations about WORLD axes at the bone's head),
# 3. each frame is rendered from a slightly-from-the-front side view with a transparent background,
# 4. the frames are packed into one PNG per animation plus a pets.json that tells the dock how many frames there are.
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig

ARGS = sys.argv[sys.argv.index('--') + 1:]
KIND, BLEND, OUT = ARGS[0], ARGS[1], ARGS[2]
ONLY = ARGS[3] if len(ARGS) > 3 and ARGS[3] != 'all' else None
CELL = int(ARGS[4]) if len(ARGS) > 4 else 256
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=BLEND)
body = bpy.data.objects['Body']
co = rig.vertex_coords(body)
X, Y, Z = co[:, 0], co[:, 1], co[:, 2]
zmin = float(Z.min())
zmax = float(Z.max())


def ramp(v, a, b):
    """0 below a, 1 above b (or the other way round when a > b), smooth in between."""
    return rig.smooth((v - a) / (b - a))


def gauss(d, r):
    return np.exp(-((d / r) ** 2))


# ---------------------------------------------------------------- the dog: four legs, floppy ears, tail
def dog():
    paws = {'FL': (-0.222, -0.365), 'FR': (0.222, -0.365), 'RL': (-0.225, 0.164), 'RR': (0.222, 0.159)}
    bones = [('root', None, (0, 0, zmin), (0, 0, zmin + 0.2)),
             ('hips', 'root', (0, 0.50, 0.00), (0, 0.10, 0.04)),
             ('chest', 'hips', (0, 0.10, 0.04), (0, -0.35, 0.08)),
             ('head', 'chest', (0, -0.33, 0.14), (0, -0.40, 0.84)),
             ('earL', 'head', (-0.44, -0.33, 0.74), (-0.80, -0.35, 0.50)),
             ('earR', 'head', (0.44, -0.33, 0.74), (0.80, -0.35, 0.50)),
             ('tail1', 'hips', (0, 0.70, 0.05), (0, 0.88, 0.12)),
             ('tail2', 'tail1', (0, 0.88, 0.12), (0, 1.0, 0.24))]
    for leg, (cx, cy) in paws.items():
        parent = 'chest' if leg[0] == 'F' else 'hips'
        bones.append((leg + 'up', parent, (cx, cy, -0.12), (cx, cy, -0.48)))
        bones.append((leg + 'lo', leg + 'up', (cx, cy, -0.48), (cx, cy, -0.80)))
    arm = rig.make_armature(bones)
    w = {}
    ears = {s: ramp(np.abs(X), 0.46, 0.60) * ramp(Z, 0.28, 0.40) * (np.sign(X) == s) for s in (-1, 1)}
    earmask = np.maximum(ears[-1], ears[1])
    headmask = ramp(Z, 0.20, 0.38) * (1 - earmask * 0.0)
    tailmask = ramp(Y, 0.66, 0.74) * (Z > -0.2) * ramp(Z, -0.2, -0.05)
    legmask = np.zeros_like(Z)
    legw = {}
    for leg, (cx, cy) in paws.items():
        g = gauss(np.hypot(X - cx, Y - cy), 0.22) * ramp(-Z, 0.02, 0.28)
        legw[leg] = g
        legmask = np.maximum(legmask, g)
    nearest = np.zeros_like(Z)
    for leg in paws:
        nearest = np.maximum(nearest, legw[leg])
    for leg in paws:
        # a vertex belongs to the leg whose axis is nearest
        share = np.where(legw[leg] >= nearest - 1e-6, legw[leg], legw[leg] * 0.15)
        lower = ramp(-Z, 0.40, 0.58)
        w[leg + 'up'] = share * (1 - lower)
        w[leg + 'lo'] = share * lower
    keep = 1 - np.maximum.reduce([headmask, legmask, tailmask, earmask])
    front = ramp(-Y, -0.05, 0.25)
    w['chest'] = np.maximum(keep, 0) * front
    w['hips'] = np.maximum(keep, 0) * (1 - front)
    w['head'] = headmask * (1 - earmask) * (1 - legmask)
    w['earL'] = ears[-1]
    w['earR'] = ears[1]
    along = ramp(Y, 0.80, 0.92)
    w['tail1'] = tailmask * (1 - along)
    w['tail2'] = tailmask * along
    return arm, w


# ---------------------------------------------------------------- the kitten: sits, so it hops instead of walking
def cat():
    bones = [('root', None, (0, 0, 0), (0, 0, 0.12)),
             ('body', 'root', (0, 0.12, 0.02), (0, 0.05, 0.46)),
             ('head', 'body', (-0.04, -0.02, 0.47), (-0.12, -0.12, 0.92)),
             ('earL', 'head', (-0.27, -0.10, 0.75), (-0.36, -0.10, 0.90)),
             ('earR', 'head', (0.08, -0.08, 0.75), (0.16, -0.08, 0.90)),
             ('tail1', 'body', (0.20, 0.32, 0.08), (0.34, 0.40, 0.14)),
             ('tail2', 'tail1', (0.34, 0.40, 0.14), (0.36, 0.40, 0.42))]
    arm = rig.make_armature(bones)
    w = {}
    headmask = ramp(Z, 0.50, 0.60)
    earL = ramp(Z, 0.76, 0.82) * ramp(-X, 0.20, 0.28)
    earR = ramp(Z, 0.76, 0.82) * ramp(X, 0.0, 0.08)
    tailmask = ramp(X, 0.22, 0.30) * ramp(-Z, -0.5, -0.3) * ramp(Y, 0.15, 0.25)
    along = ramp(Z, 0.14, 0.30)
    keep = 1 - np.maximum(headmask, tailmask)
    w['body'] = keep
    w['head'] = headmask * (1 - np.maximum(earL, earR))
    w['earL'] = earL
    w['earR'] = earR
    w['tail1'] = tailmask * (1 - along)
    w['tail2'] = tailmask * along
    return arm, w


arm, weights = dog() if KIND == 'dog' else cat()
rig.apply_weights(body, arm, weights)

# ---------------------------------------------------------------- posing
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
for pb in arm.pose.bones:
    pb.rotation_mode = 'QUATERNION'
REST = {b.name: b.matrix_local.copy() for b in arm.data.bones}
HEAD = {b.name: Vector(b.head_local) for b in arm.data.bones}


def pose(spec):
    """spec: bone -> dict(rot=(rx, ry, rz) degrees about world axes, move=(dx, dy, dz), scale=(sx, sy, sz)). Missing bones rest."""
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    for name, t in spec.items():
        pb = arm.pose.bones[name]
        head = HEAD[name]
        rx, ry, rz = [math.radians(a) for a in t.get('rot', (0, 0, 0))]
        R = Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X')
        sx, sy, sz = t.get('scale', (1, 1, 1))
        S = Matrix.Diagonal((sx, sy, sz, 1.0))
        pivot = Vector(t.get('pivot', head))
        T = Matrix.Translation(Vector(t.get('move', (0, 0, 0))) + pivot) @ R @ S @ Matrix.Translation(-pivot)
        rest = REST[name]
        pb.matrix_basis = rest.inverted() @ T @ rest
    bpy.context.view_layer.update()


def lowest():
    """The lowest point (z) of the mesh as it is deformed by the current pose."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    arr = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get('co', arr)
    ev.to_mesh_clear()
    return float(arr.reshape(-1, 3)[:, 2].min())


GROUNDED = ('idle', 'sit', 'sleep', 'play')


def pose_grounded(spec, name):
    """Poses that are meant to rest on the floor are lowered or raised until the lowest paw touches it."""
    pose(spec)
    if name not in GROUNDED:
        return
    dz = zmin - lowest()
    if abs(dz) > 0.004:
        root = dict(spec.get('root', {}))
        mv = root.get('move', (0, 0, 0))
        root['move'] = (mv[0], mv[1], mv[2] + dz)
        spec = dict(spec)
        spec['root'] = root
        pose(spec)


def s(phase, k=1.0, off=0.0):
    return math.sin(2 * math.pi * (phase * k + off))


def c(phase, k=1.0, off=0.0):
    return math.cos(2 * math.pi * (phase * k + off))


def dog_anim(name, p):
    sp = {}
    legs = {'FL': 0.0, 'FR': 0.5, 'RL': 0.5, 'RR': 0.0}
    if name in ('walk', 'run', 'carry'):
        fast = name != 'walk'
        A = 34 if fast else 24
        K = 55 if fast else 38
        offs = {'FL': 0.0, 'FR': 0.12, 'RL': 0.5, 'RR': 0.62} if fast else legs
        for leg, off in offs.items():
            psi = 2 * math.pi * (p + off)
            sp[leg + 'up'] = {'rot': (A * math.sin(psi), 0, 0)}
            sp[leg + 'lo'] = {'rot': (K * max(0.0, -math.cos(psi)), 0, 0)}
        bob = (0.045 if fast else 0.02) * math.cos(4 * math.pi * p * (0.5 if fast else 1))
        sp['root'] = {'move': (0, 0, bob - 0.01)}
        sp['hips'] = {'rot': (3 * s(p, 2 if not fast else 1), 0, 0)}
        sp['chest'] = {'rot': (-3 * s(p, 2 if not fast else 1), 3 * s(p), 0)}
        sp['head'] = {'rot': (-4 * s(p, 2) - (10 if name == 'carry' else 0), 0, 4 * s(p, 1, 0.25))}
        sp['tail1'] = {'rot': (-20 if fast else -8, 0, 20 * s(p, 2 if fast else 1))}
        sp['tail2'] = {'rot': (0, 0, 20 * s(p, 2 if fast else 1, 0.2))}
        sp['earL'] = {'rot': (0, 12 * (1 if fast else 0.4) * s(p, 2), 0)}
        sp['earR'] = {'rot': (0, -12 * (1 if fast else 0.4) * s(p, 2), 0)}
    elif name == 'idle':
        sp['chest'] = {'scale': (1, 1, 1 + 0.012 * s(p)), 'pivot': (0, 0.1, -0.2)}
        sp['head'] = {'rot': (2 * s(p), 0, 5 * s(p, 1, 0.25))}
        sp['tail1'] = {'rot': (0, 0, 14 * s(p))}
        sp['tail2'] = {'rot': (0, 0, 14 * s(p, 1, 0.25))}
        sp['earL'] = {'rot': (0, 4 * s(p, 2), 0)}
        sp['earR'] = {'rot': (0, -4 * s(p, 2), 0)}
    elif name == 'sit':
        # the hindquarters drop and the front stays up; the rear legs fold under
        sp['root'] = {'move': (0, 0.0, -0.1)}
        sp['hips'] = {'rot': (-14, 0, 0), 'pivot': (0, 0.45, -0.1)}
        for leg in ('RL', 'RR'):
            sp[leg + 'up'] = {'rot': (-34 + 14, 0, 0)}
            sp[leg + 'lo'] = {'rot': (64, 0, 0)}
        for leg in ('FL', 'FR'):
            sp[leg + 'up'] = {'rot': (14, 0, 0)}
        sp['chest'] = {'rot': (4 * s(p), 0, 0)}
        sp['head'] = {'rot': (-4 + 3 * s(p), 0, 6 * s(p, 1, 0.25))}
        sp['tail1'] = {'rot': (0, 0, 12 * s(p))}
        sp['tail2'] = {'rot': (0, 0, 12 * s(p, 1, 0.25))}
    elif name == 'sleep':
        sp['root'] = {'move': (0, 0, -0.55)}
        for leg in ('FL', 'FR'):
            sp[leg + 'up'] = {'rot': (-82, 0, 0)}
            sp[leg + 'lo'] = {'rot': (-12, 0, 0)}
        for leg in ('RL', 'RR'):
            sp[leg + 'up'] = {'rot': (-70, 0, 0)}
            sp[leg + 'lo'] = {'rot': (70, 0, 0)}
        sp['chest'] = {'scale': (1, 1, 1 + 0.02 * s(p)), 'pivot': (0, 0.1, -0.5)}
        sp['head'] = {'rot': (38, 0, 0)}
        sp['tail1'] = {'rot': (0, 0, 40)}
        sp['earL'] = {'rot': (0, -12, 0)}
        sp['earR'] = {'rot': (0, 12, 0)}
    elif name == 'play':
        # a play bow: the chest goes down, the rear stays up, the tail goes wild
        sp['root'] = {'move': (0, 0, 0.0)}
        sp['chest'] = {'rot': (22 + 4 * s(p, 2), 0, 0), 'pivot': (0, 0.1, 0.0)}
        for leg in ('FL', 'FR'):
            sp[leg + 'up'] = {'rot': (-35 - 8 * s(p, 2), 0, 0)}
            sp[leg + 'lo'] = {'rot': (20, 0, 0)}
        sp['head'] = {'rot': (-16 + 6 * s(p, 2), 0, 8 * s(p))}
        sp['tail1'] = {'rot': (-30, 0, 35 * s(p, 3))}
        sp['tail2'] = {'rot': (0, 0, 35 * s(p, 3, 0.2))}
        sp['earL'] = {'rot': (0, 14 * s(p, 2), 0)}
        sp['earR'] = {'rot': (0, -14 * s(p, 2), 0)}
    elif name == 'happy':
        hop = abs(s(p, 1, 0)) * 0.10
        sp['root'] = {'move': (0, 0, hop)}
        for leg in ('FL', 'FR', 'RL', 'RR'):
            sp[leg + 'up'] = {'rot': (-18 * hop / 0.10, 0, 0)}
            sp[leg + 'lo'] = {'rot': (25 * hop / 0.10, 0, 0)}
        sp['head'] = {'rot': (-8, 0, 10 * s(p, 2))}
        sp['tail1'] = {'rot': (-35, 0, 45 * s(p, 4))}
        sp['tail2'] = {'rot': (0, 0, 45 * s(p, 4, 0.2))}
        sp['earL'] = {'rot': (0, 22 * s(p, 2), 0)}
        sp['earR'] = {'rot': (0, -22 * s(p, 2), 0)}
    elif name == 'held':
        sw = s(p)
        sp['root'] = {'move': (0, 0, -0.1), 'rot': (-16 + 4 * sw, 0, 5 * sw), 'pivot': (0, -0.2, 0.3)}
        for leg in ('FL', 'FR'):
            sp[leg + 'up'] = {'rot': (-18 + 12 * sw, 0, 0)}
            sp[leg + 'lo'] = {'rot': (15 + 10 * sw, 0, 0)}
        for leg in ('RL', 'RR'):
            sp[leg + 'up'] = {'rot': (15 - 12 * sw, 0, 0)}
            sp[leg + 'lo'] = {'rot': (30 - 10 * sw, 0, 0)}
        sp['tail1'] = {'rot': (0, 0, 15 * sw)}
        sp['earL'] = {'rot': (0, 10 * sw, 0)}
        sp['earR'] = {'rot': (0, -10 * sw, 0)}
    elif name == 'fall':
        sp['root'] = {'move': (0, 0, 0.12 * (1 - p)), 'rot': (-6 + 14 * p, 0, 0)}
        for leg, a in (('FL', -40), ('FR', -48), ('RL', 38), ('RR', 44)):
            sp[leg + 'up'] = {'rot': (a, 0, 0)}
            sp[leg + 'lo'] = {'rot': (12, 0, 0)}
        sp['tail1'] = {'rot': (-30, 0, 20 * s(p))}
        sp['earL'] = {'rot': (0, -30, 0)}
        sp['earR'] = {'rot': (0, 30, 0)}
    return sp


def cat_anim(name, p):
    sp = {}
    if name in ('walk', 'run', 'carry'):
        # a kitten that sits cannot stride, so it hops along: squash, stretch, leap, land
        fast = name != 'walk'
        h = (0.10 if fast else 0.055) * max(0.0, math.sin(2 * math.pi * p))
        land = max(0.0, -math.sin(2 * math.pi * p))
        sq = 1.0 - 0.07 * land
        sp['root'] = {'move': (0, 0, h), 'scale': (1 + 0.04 * land, 1 + 0.04 * land, sq), 'pivot': (0, 0, 0), 'rot': (-5 if fast else -2, 0, 0)}
        sp['head'] = {'rot': (-5 * s(p) - 3, 0, 5 * s(p, 1, 0.25))}
        sp['tail1'] = {'rot': (0, 0, 22 * s(p, 1, 0.2))}
        sp['tail2'] = {'rot': (0, 0, 28 * s(p, 1, 0.4))}
        sp['earL'] = {'rot': (0, 10 * s(p, 1, 0.1), 0)}
        sp['earR'] = {'rot': (0, -10 * s(p, 1, 0.1), 0)}
    elif name in ('idle', 'sit'):
        sp['body'] = {'scale': (1, 1, 1 + 0.012 * s(p)), 'pivot': (0, 0, 0)}
        sp['head'] = {'rot': (2 * s(p), 0, 6 * s(p, 1, 0.25))}
        sp['tail1'] = {'rot': (0, 0, 14 * s(p))}
        sp['tail2'] = {'rot': (0, 0, 18 * s(p, 1, 0.25))}
        sp['earL'] = {'rot': (0, 5 * s(p, 2), 0)}
        sp['earR'] = {'rot': (0, -5 * s(p, 2), 0)}
    elif name == 'sleep':
        sp['body'] = {'scale': (1, 1, 1 + 0.02 * s(p)), 'pivot': (0, 0, 0), 'rot': (6, 0, 0)}
        sp['head'] = {'rot': (34 + 3 * s(p), 0, 8)}
        sp['tail1'] = {'rot': (0, 0, 6 * s(p))}
        sp['earL'] = {'rot': (0, -14, 0)}
        sp['earR'] = {'rot': (0, 14, 0)}
    elif name == 'play':
        sp['root'] = {'rot': (-12 - 5 * s(p, 2), 0, 0), 'move': (0, -0.03, 0)}
        sp['head'] = {'rot': (14 * s(p, 2), 0, 10 * s(p))}
        sp['tail1'] = {'rot': (0, 0, 30 * s(p, 3))}
        sp['tail2'] = {'rot': (0, 0, 34 * s(p, 3, 0.2))}
        sp['earL'] = {'rot': (0, 12 * s(p, 2), 0)}
        sp['earR'] = {'rot': (0, -12 * s(p, 2), 0)}
    elif name == 'happy':
        h = 0.09 * abs(s(p))
        sp['root'] = {'move': (0, 0, h), 'scale': (1, 1, 1 + 0.03 * (h / 0.09))}
        sp['head'] = {'rot': (-6, 0, 12 * s(p, 2))}
        sp['tail1'] = {'rot': (0, 0, 40 * s(p, 4))}
        sp['tail2'] = {'rot': (0, 0, 40 * s(p, 4, 0.2))}
        sp['earL'] = {'rot': (0, 18 * s(p, 2), 0)}
        sp['earR'] = {'rot': (0, -18 * s(p, 2), 0)}
    elif name == 'held':
        sw = s(p)
        sp['root'] = {'rot': (-14 + 4 * sw, 0, 6 * sw), 'pivot': (0, 0, 0.8), 'move': (0, 0, -0.05)}
        sp['tail1'] = {'rot': (0, 0, 18 * sw)}
        sp['tail2'] = {'rot': (0, 0, 22 * s(p, 1, 0.2))}
        sp['earL'] = {'rot': (0, 12 * sw, 0)}
        sp['earR'] = {'rot': (0, -12 * sw, 0)}
    elif name == 'fall':
        sp['root'] = {'move': (0, 0, 0.1 * (1 - p)), 'rot': (-8 + 16 * p, 0, 0), 'scale': (1, 1, 1 + 0.05 * (1 - p))}
        sp['tail1'] = {'rot': (-30, 0, 20 * s(p))}
        sp['earL'] = {'rot': (0, -32, 0)}
        sp['earR'] = {'rot': (0, 32, 0)}
    return sp


ANIMS = {'idle': 8, 'walk': 12, 'run': 10, 'carry': 10, 'sit': 8, 'sleep': 8, 'play': 10, 'happy': 8, 'held': 8, 'fall': 4}
anim_fn = dog_anim if KIND == 'dog' else cat_anim

# ---------------------------------------------------------------- scene: light, camera, render settings
sc = bpy.context.scene
for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'BLENDER_WORKBENCH'):
    try:
        sc.render.engine = engine
        break
    except TypeError:
        continue
print('ENGINE', sc.render.engine)
sc.render.film_transparent = True
sc.render.resolution_x = CELL
sc.render.resolution_y = CELL
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'
world = bpy.data.worlds.new('W')
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.82, 0.86, 0.95, 1)
bg.inputs[1].default_value = 0.55
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 2.3
sun.rotation_euler = (math.radians(50), math.radians(-12), math.radians(-35))
sc.collection.objects.link(sun)
fill = bpy.data.objects.new('Fill', bpy.data.lights.new('Fill', 'SUN'))
fill.data.energy = 0.7
fill.rotation_euler = (math.radians(65), math.radians(20), math.radians(140))
sc.collection.objects.link(fill)

centre = Vector((0, 0, (zmin + zmax) / 2))
size = max(X.max() - X.min(), Y.max() - Y.min(), zmax - zmin)
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = size * 1.62
cam = bpy.data.objects.new('cam', cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
yaw = math.radians(26)
view = Vector((-math.cos(yaw), -math.sin(yaw), 0.10)).normalized()
cam.location = centre + view * size * 4
cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()

from bpy_extras.object_utils import world_to_camera_view
bpy.context.view_layer.update()
ground = world_to_camera_view(sc, cam, Vector((0, 0, zmin)))
meta = {'cell': CELL, 'footY': round(1 - ground.y, 4), 'centreX': round(ground.x, 4), 'anims': {}}

# ---------------------------------------------------------------- render every animation and pack it
for name, frames in ANIMS.items():
    if ONLY and name != ONLY:
        continue
    atlas = np.zeros((CELL, CELL * frames, 4), dtype=np.float32)
    for i in range(frames):
        pose_grounded(anim_fn(name, i / frames), name)
        path = os.path.join(OUT, f'_f.png')
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(path, check_existing=False)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(CELL, CELL, 4)[::-1]  # Blender stores rows bottom-up
        bpy.data.images.remove(img)
        atlas[:, i * CELL:(i + 1) * CELL] = px
    out_img = bpy.data.images.new('atlas', CELL * frames, CELL, alpha=True)
    out_img.pixels = atlas[::-1].reshape(-1).tolist()
    out_img.filepath_raw = os.path.join(OUT, f'{KIND}-{name}.png')
    out_img.file_format = 'PNG'
    out_img.save()
    bpy.data.images.remove(out_img)
    meta['anims'][name] = frames
    print('RENDERED', name, frames)
try:
    os.remove(os.path.join(OUT, '_f.png'))
except OSError:
    pass
with open(os.path.join(OUT, f'{KIND}.json'), 'w') as f:
    json.dump(meta, f)
print('DONE', meta)
