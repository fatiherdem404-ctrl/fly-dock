# Animates the rigged cat from build_cat.py and renders every animation to a sprite sheet (frames side by side, transparent).
#
#   blender -b cat.blend --python tools/pets/animate_cat.py -- <out dir> [animation|all] [cell size]
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:]
OUT = ARGS[0]
ONLY = ARGS[1] if len(ARGS) > 1 and ARGS[1] != 'all' else None
CELL = int(ARGS[2]) if len(ARGS) > 2 else 256
os.makedirs(OUT, exist_ok=True)

arm = bpy.data.objects['CatRig']
sc = bpy.context.scene
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
for pb in arm.pose.bones:
    pb.rotation_mode = 'QUATERNION'
REST = {b.name: b.matrix_local.copy() for b in arm.data.bones}
HEAD = {b.name: Vector(b.head_local) for b in arm.data.bones}


def pose(spec):
    """spec: bone -> dict(rot=(rx, ry, rz) degrees about WORLD axes through the bone's head (or `pivot`), move=(dx, dy, dz)).
    Bones not mentioned rest. IK feet are plain bones too: moving one drags the leg with it."""
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    for name, t in spec.items():
        pb = arm.pose.bones[name]
        rx, ry, rz = [math.radians(a) for a in t.get('rot', (0, 0, 0))]
        R = Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X')
        pivot = Vector(t.get('pivot', HEAD[name]))
        T = Matrix.Translation(Vector(t.get('move', (0, 0, 0))) + pivot) @ R @ Matrix.Translation(-pivot)
        rest = REST[name]
        pb.matrix_basis = rest.inverted() @ T @ rest
    bpy.context.view_layer.update()


def s(ph, k=1.0, off=0.0):
    return math.sin(2 * math.pi * (ph * k + off))


def c(ph, k=1.0, off=0.0):
    return math.cos(2 * math.pi * (ph * k + off))


def blink(ph, at, width=0.1):
    """0 (open) .. 1 (shut) pulse around phase `at`."""
    d = abs(((ph - at + 0.5) % 1) - 0.5)
    return max(0.0, 1 - d / width)


def eyes(sp, shut):
    """Both eyelids: 0 = open, 1 = shut (the lids are modelled open and close by turning 180 degrees)."""
    for side in ('L', 'R'):
        sp[f'lidup{side}'] = {'rot': (202 * shut, 0, 0)}
        sp[f'lidlo{side}'] = {'rot': (-202 * shut, 0, 0)}


def tail(sp, ph, amp=14, speed=1, base=0, lift=0):
    for i in range(6):
        sp[f'tail{i}'] = {'rot': (lift / 6.0, 0, base / 6.0 + amp * s(ph, speed, -i * 0.09) * (0.6 + i * 0.12))}


def ears(sp, ph, amp=6, back=0.0):
    sp['earL'] = {'rot': (0, amp * s(ph, 2, 0.1) + back, 0)}
    sp['earR'] = {'rot': (0, -amp * s(ph, 2, 0.35) - back, 0)}


def foot(p, stride, lift):
    p %= 1.0
    if p < 0.6:
        return -stride + 2 * stride * (p / 0.6), 0.0           # stance: from the front back to the rear
    q = (p - 0.6) / 0.4
    return stride - 2 * stride * q, math.sin(q * math.pi) * lift  # swing: back to the front through the air


def anim(name, ph):
    sp = {}
    if name in ('walk', 'run', 'carry'):
        fast = name != 'walk'
        S = 0.10 if fast else 0.065
        L = 0.065 if fast else 0.035
        offs = {'hL': 0.0, 'hR': 0.08, 'fL': 0.5, 'fR': 0.58} if fast else {'hL': 0.0, 'fL': 0.25, 'hR': 0.5, 'fR': 0.75}
        for key, off in offs.items():
            dy, dz = foot(ph + off, S, L)
            sp[f'{key[0]}ik{key[1]}'] = {'move': (0, dy, dz)}
        bob = 0.018 if fast else 0.007
        sp['hips'] = {'move': (0, 0, bob * c(ph, 2 if not fast else 1)), 'rot': ((-5 if fast else -1.5) * s(ph, 2 if not fast else 1), 0, 4 * s(ph))}
        sp['spine'] = {'rot': (3 * s(ph, 2 if not fast else 1, 0.25), 0, -5 * s(ph))}
        sp['neck'] = {'rot': (-2 * s(ph, 2), 0, -3 * s(ph))}
        sp['head'] = {'rot': (2 * s(ph, 2, 0.1), 0, 3 * s(ph, 1, 0.3))}
        tail(sp, ph, 10 if not fast else 6, 1, lift=20 if fast else 8)
        ears(sp, ph, 4 if not fast else 8, back=0 if not fast else 12)
        eyes(sp, blink(ph, 0.7))
    elif name == 'idle':
        sp['hips'] = {'move': (0, 0, 0.0025 * s(ph)), 'rot': (0.6 * s(ph), 0, 0)}
        sp['spine'] = {'rot': (0.8 * s(ph, 1, 0.1), 0, 0)}
        sp['head'] = {'rot': (2 * s(ph, 1, 0.2), 0, 7 * s(ph, 1, 0.25))}
        sp['neck'] = {'rot': (0, 0, 3 * s(ph, 1, 0.25))}
        tail(sp, ph, 16, 1, base=-12)
        ears(sp, ph, 5)
        eyes(sp, blink(ph, 0.55, 0.07))
    elif name == 'sit':
        sp['hips'] = {'move': (0, 0.0, -0.12), 'rot': (-6, 0, 0)}
        sp['spine'] = {'rot': (-30, 0, 0), 'pivot': (0, 0.0, 0.225)}
        sp['neck'] = {'rot': (12, 0, 4 * s(ph, 1, 0.25))}
        sp['head'] = {'rot': (8 + 2 * s(ph), 0, 8 * s(ph, 1, 0.25))}
        for side in ('L', 'R'):
            sp[f'hik{side}'] = {'move': (0, -0.09, 0)}
            sp[f'fik{side}'] = {'move': (0, 0.0, 0)}
        tail(sp, ph, 12, 1, base=-25)
        ears(sp, ph, 5)
        eyes(sp, blink(ph, 0.4, 0.07))
    elif name == 'sleep':
        sp['hips'] = {'move': (0, -0.01, -0.145), 'rot': (0, 0, 8)}
        sp['spine'] = {'move': (0, 0, -0.07), 'rot': (4 + 1.2 * s(ph), 0, 14)}
        sp['neck'] = {'rot': (24, 0, 20)}
        sp['head'] = {'rot': (22, 0, 18)}
        for side, sx in (('L', -1), ('R', 1)):
            sp[f'hik{side}'] = {'move': (sx * -0.025, -0.07, 0)}
            sp[f'fik{side}'] = {'move': (sx * -0.01, -0.02, 0)}
        tail(sp, ph, 4, 1, base=-90)
        ears(sp, ph, 2, back=-10)
        eyes(sp, 1.0)
    elif name == 'play':
        sp['spine'] = {'rot': (22 + 4 * s(ph, 2), 0, 0), 'pivot': (0, 0.0, 0.225)}
        sp['hips'] = {'move': (0, 0, 0.02), 'rot': (-4, 0, 6 * s(ph, 2))}
        sp['head'] = {'rot': (-14 + 5 * s(ph, 2), 0, 8 * s(ph))}
        for side in ('L', 'R'):
            sp[f'fik{side}'] = {'move': (0, -0.07 - 0.02 * s(ph, 2), 0.0)}
        tail(sp, ph, 26, 3, lift=26)
        ears(sp, ph, 10, back=-6)
        eyes(sp, blink(ph, 0.5, 0.08))
    elif name == 'happy':
        up = abs(s(ph, 1)) * 0.05
        sp['hips'] = {'move': (0, 0, up)}
        sp['spine'] = {'rot': (-4, 0, 3 * s(ph, 2))}
        sp['head'] = {'rot': (-8, 0, 10 * s(ph, 2))}
        for key in ('hL', 'hR', 'fL', 'fR'):
            sp[f'{key[0]}ik{key[1]}'] = {'move': (0, 0, up * 0.2)}
        tail(sp, ph, 22, 4, lift=40)
        ears(sp, ph, 8, back=-8)
        eyes(sp, 0.78)
    elif name == 'held':
        sw = s(ph)
        sp['root'] = {'rot': (38 + 3 * sw, 0, 5 * sw), 'pivot': (0, -0.22, 0.3), 'move': (0, 0, 0.0)}
        for key in ('hL', 'hR', 'fL', 'fR'):
            sp[f'{key[0]}ik{key[1]}'] = {'move': (0, (0.03 if key[0] == 'h' else -0.02) * sw, 0.15 + 0.01 * sw)}
        tail(sp, ph, 14, 1, lift=-15)
        ears(sp, ph, 4, back=14)
        eyes(sp, 0.1)
    elif name == 'fall':
        t = ph
        sp['hips'] = {'move': (0, 0, 0.05 * (1 - t)), 'rot': (-6 + 12 * t, 0, 0)}
        for key, (dy, dz) in {'hL': (0.06, 0.12), 'hR': (0.08, 0.10), 'fL': (-0.07, 0.12), 'fR': (-0.09, 0.10)}.items():
            sp[f'{key[0]}ik{key[1]}'] = {'move': (0, dy, dz * (1 - t * 0.6))}
        tail(sp, ph, 8, 1, lift=30)
        ears(sp, ph, 2, back=22)
        eyes(sp, 0.0)
    return sp


ANIMS = {'idle': 12, 'walk': 12, 'run': 10, 'carry': 10, 'sit': 12, 'sleep': 12, 'play': 12, 'happy': 8, 'held': 8, 'fall': 4}
GROUNDED = ('idle', 'sit', 'sleep', 'play')

# ------------------------------------------------------------------ scene: light, camera, render settings
for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try:
        sc.render.engine = engine
        break
    except TypeError:
        continue
sc.render.film_transparent = True
sc.render.resolution_x = CELL
sc.render.resolution_y = CELL
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'
world = bpy.data.worlds.new('W')
sc.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.82, 0.86, 0.95, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 2.4
sun.rotation_euler = (math.radians(50), math.radians(-12), math.radians(-35))
sc.collection.objects.link(sun)
fill = bpy.data.objects.new('Fill', bpy.data.lights.new('Fill', 'SUN'))
fill.data.energy = 0.8
fill.rotation_euler = (math.radians(65), math.radians(20), math.radians(140))
sc.collection.objects.link(fill)
centre = Vector((0, 0.08, 0.30))
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 1.22
cam = bpy.data.objects.new('cam', cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
yaw = math.radians(26)
view = Vector((-math.cos(yaw), -math.sin(yaw), 0.10)).normalized()
cam.location = centre + view * 4
cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
bpy.context.view_layer.update()
from bpy_extras.object_utils import world_to_camera_view


def frame_camera():
    """Centres the cat in the picture and sizes the picture to fit it with some room for the animations."""
    xs, ys = [], []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        for v in list(me.vertices)[::7]:
            p = world_to_camera_view(sc, cam, ev.matrix_world @ v.co)
            xs.append(p.x)
            ys.append(p.y)
        ev.to_mesh_clear()
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    scale = cam_data.ortho_scale
    right = cam.matrix_world.to_3x3() @ Vector((1, 0, 0))
    up = cam.matrix_world.to_3x3() @ Vector((0, 1, 0))
    cam.location += right * (cx - 0.5) * scale + up * (cy - 0.5) * scale
    print('FRAME', round(cx, 3), round(cy, 3), round(w, 3), round(h, 3), scale)
    cam_data.ortho_scale = scale * max(w, h) * 1.28
    bpy.context.view_layer.update()


frame_camera()
ground = world_to_camera_view(sc, cam, Vector((0, 0.0, 0.0)))
meta = {'cell': CELL, 'footY': round(1 - ground.y, 4), 'centreX': round(ground.x, 4), 'anims': {}}

bodies = [o for o in bpy.data.objects if o.type == 'MESH']


def lowest():
    dg = bpy.context.evaluated_depsgraph_get()
    zmin = 9.0
    for o in bodies:
        if o.name not in ('Body', 'Skull'):
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        arr = np.empty(len(me.vertices) * 3, dtype=np.float32)
        me.vertices.foreach_get('co', arr)
        mw = np.array(ev.matrix_world, dtype=np.float32)
        world = arr.reshape(-1, 3) @ mw[:3, :3].T + mw[:3, 3]
        ev.to_mesh_clear()
        zmin = min(zmin, float(world[:, 2].min()))
    return zmin


def pose_grounded(spec, name):
    pose(spec)
    if name not in GROUNDED:
        return
    dz = 0.0 - lowest()
    if abs(dz) > 0.003:
        spec = dict(spec)
        root = dict(spec.get('root', {}))
        mv = root.get('move', (0, 0, 0))
        root['move'] = (mv[0], mv[1], mv[2] + dz)
        spec['root'] = root
        pose(spec)


for name, frames in ANIMS.items():
    if ONLY and name != ONLY:
        continue
    atlas = np.zeros((CELL, CELL * frames, 4), dtype=np.float32)
    for i in range(frames):
        pose_grounded(anim(name, i / frames), name)
        path = os.path.join(OUT, '_f.png')
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(path, check_existing=False)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(CELL, CELL, 4)[::-1]
        bpy.data.images.remove(img)
        atlas[:, i * CELL:(i + 1) * CELL] = px
    out_img = bpy.data.images.new('atlas', CELL * frames, CELL, alpha=True)
    out_img.pixels = atlas[::-1].reshape(-1).tolist()
    out_img.filepath_raw = os.path.join(OUT, f'cat-{name}.png')
    out_img.file_format = 'PNG'
    out_img.save()
    bpy.data.images.remove(out_img)
    meta['anims'][name] = frames
    print('RENDERED', name, frames)
try:
    os.remove(os.path.join(OUT, '_f.png'))
except OSError:
    pass
with open(os.path.join(OUT, 'cat.json'), 'w') as f:
    json.dump(meta, f)
print('DONE', meta)
