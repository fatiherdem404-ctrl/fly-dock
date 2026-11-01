# Models a cartoon-realistic cat from scratch (no downloaded mesh): a smooth body grown from a skeleton of radii with the
# Skin modifier, a separate head with real eyeballs, pupils and EYELIDS, ears, nose, whiskers and a tail, all rigged with
# a bone rig whose legs use IK, so walking, blinking and every other motion can be keyed properly.
#
#   blender -b --factory-startup --python tools/pets/build_cat.py -- <out.blend>
import bpy, bmesh, math, sys
from mathutils import Vector, Matrix

OUT = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ------------------------------------------------------------------ materials
def material(name, base, rough=0.75, sheen=0.0, bump=0.0, noise_scale=300.0, extra=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = base
    bsdf.inputs['Roughness'].default_value = rough
    if 'Sheen Weight' in bsdf.inputs:
        bsdf.inputs['Sheen Weight'].default_value = sheen
        bsdf.inputs['Sheen Roughness'].default_value = 0.5
    if bump:
        tex = nt.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = noise_scale
        tex.inputs['Detail'].default_value = 8
        b = nt.nodes.new('ShaderNodeBump')
        b.inputs['Strength'].default_value = bump
        coord = nt.nodes.new('ShaderNodeTexCoord')
        nt.links.new(coord.outputs['Object'], tex.inputs['Vector'])
        nt.links.new(tex.outputs['Fac'], b.inputs['Height'])
        nt.links.new(b.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def fur_material(name, c1, c2, stripes=True):
    """Fur colour: a base coat with darker tabby stripes along the body and a pale chest and belly."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.85
    if 'Sheen Weight' in bsdf.inputs:
        bsdf.inputs['Sheen Weight'].default_value = 0.8
        bsdf.inputs['Sheen Roughness'].default_value = 0.4
    coord = nodes.new('ShaderNodeTexCoord')
    sep = nodes.new('ShaderNodeSeparateXYZ')
    links.new(coord.outputs['Object'], sep.inputs['Vector'])
    # stripes: a wave texture across the body, wobbled by noise
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 7
    noise.inputs['Detail'].default_value = 3
    links.new(coord.outputs['Object'], noise.inputs['Vector'])
    wave = nodes.new('ShaderNodeTexWave')
    wave.bands_direction = 'Y'
    wave.inputs['Scale'].default_value = 5
    wave.inputs['Distortion'].default_value = 2.2
    wave.inputs['Detail'].default_value = 1
    links.new(coord.outputs['Object'], wave.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[1].position = 0.78
    links.new(wave.outputs['Fac'], ramp.inputs['Fac'])
    mix1 = nodes.new('ShaderNodeMix')
    mix1.data_type = 'RGBA'
    mix1.inputs[6].default_value = c1
    mix1.inputs[7].default_value = c2
    links.new(ramp.outputs['Color'], mix1.inputs[0])
    # a pale belly and chest: the lower the paler
    belly = nodes.new('ShaderNodeValToRGB')
    belly.color_ramp.elements[0].position = 0.38
    belly.color_ramp.elements[1].position = 0.48
    belly.color_ramp.elements[0].color = (1, 1, 1, 1)
    belly.color_ramp.elements[1].color = (0, 0, 0, 1)
    geo = nodes.new('ShaderNodeNewGeometry')
    nsep = nodes.new('ShaderNodeSeparateXYZ')
    links.new(geo.outputs['Normal'], nsep.inputs['Vector'])
    nmap = nodes.new('ShaderNodeMapRange')
    nmap.inputs['From Min'].default_value = -1
    nmap.inputs['From Max'].default_value = 1
    links.new(nsep.outputs['Z'], nmap.inputs['Value'])
    links.new(nmap.outputs['Result'], belly.inputs['Fac'])
    mix2 = nodes.new('ShaderNodeMix')
    mix2.data_type = 'RGBA'
    mix2.inputs[7].default_value = (0.96, 0.93, 0.88, 1)
    links.new(mix1.outputs[2], mix2.inputs[6])
    links.new(belly.outputs['Color'], mix2.inputs[0])
    links.new(mix2.outputs[2], bsdf.inputs['Base Color'])
    # a fine fur-like bump
    tex = nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = 600
    tex.inputs['Detail'].default_value = 6
    b = nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = 0.25
    links.new(coord.outputs['Object'], tex.inputs['Vector'])
    links.new(tex.outputs['Fac'], b.inputs['Height'])
    links.new(b.outputs['Normal'], bsdf.inputs['Normal'])
    return m


FUR = fur_material('Fur', (0.80, 0.52, 0.27, 1), (0.42, 0.22, 0.09, 1))
FUR_HEAD = fur_material('FurHead', (0.80, 0.52, 0.27, 1), (0.42, 0.22, 0.09, 1))
WHITE = material('White', (0.97, 0.94, 0.9, 1), 0.85, sheen=0.8, bump=0.2, noise_scale=500)
PINK = material('Pink', (0.92, 0.55, 0.55, 1), 0.5)
NOSE = material('Nose', (0.88, 0.45, 0.48, 1), 0.35)
EYE_WHITE = material('EyeWhite', (0.95, 0.95, 0.92, 1), 0.15)
IRIS = material('Iris', (0.25, 0.65, 0.20, 1), 0.2)
PUPIL = material('Pupil', (0.01, 0.01, 0.01, 1), 0.05)
WHISKER = material('Whisker', (0.95, 0.95, 0.95, 1), 0.4)
EYELID = fur_material('Eyelid', (0.80, 0.52, 0.27, 1), (0.42, 0.22, 0.09, 1))


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def smooth(obj, levels=2):
    for p in obj.data.polygons:
        p.use_smooth = True
    if levels:
        mod = obj.modifiers.new('Subsurf', 'SUBSURF')
        mod.levels = levels
        mod.render_levels = levels


def sphere(name, loc, scale, mat, seg=32, rings=16, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    ob.location = loc
    ob.scale = scale
    for p in me.polygons:
        p.use_smooth = True
    assign(ob, mat)
    return ob


# ------------------------------------------------------------------ the body, grown from a skeleton of radii
# (x across, y along: the nose points to -Y, z up). Radii are in metres.
SK = {}


def skin_body():
    verts, radii, edges = [], [], []

    def v(name, co, r):
        SK[name] = len(verts)
        verts.append(co)
        radii.append(r)

    def e(a, b):
        edges.append((SK[a], SK[b]))

    v('pelvis', (0, 0.13, 0.21), (0.098, 0.105))
    v('mid', (0, 0.01, 0.22), (0.088, 0.095))
    v('chest', (0, -0.115, 0.235), (0.102, 0.112))
    v('neck', (0, -0.19, 0.27), (0.078, 0.082))
    v('neck2', (0, -0.235, 0.305), (0.062, 0.066))
    e('pelvis', 'mid'); e('mid', 'chest'); e('chest', 'neck'); e('neck', 'neck2')
    for side, sx in (('L', -1), ('R', 1)):
        # front leg: shoulder, elbow, wrist, paw
        v(f'fs{side}', (sx * 0.055, -0.10, 0.19), (0.064, 0.07))
        v(f'fe{side}', (sx * 0.055, -0.10, 0.105), (0.048, 0.05))
        v(f'fw{side}', (sx * 0.055, -0.11, 0.04), (0.037, 0.039))
        v(f'fp{side}', (sx * 0.055, -0.135, 0.013), (0.038, 0.05))
        e('chest', f'fs{side}'); e(f'fs{side}', f'fe{side}'); e(f'fe{side}', f'fw{side}'); e(f'fw{side}', f'fp{side}')
        # hind leg: hip, knee, hock, paw
        v(f'hh{side}', (sx * 0.065, 0.15, 0.185), (0.076, 0.088))
        v(f'hk{side}', (sx * 0.065, 0.11, 0.105), (0.058, 0.062))
        v(f'hc{side}', (sx * 0.065, 0.19, 0.055), (0.036, 0.038))
        v(f'hp{side}', (sx * 0.065, 0.17, 0.013), (0.038, 0.052))
        e('pelvis', f'hh{side}'); e(f'hh{side}', f'hk{side}'); e(f'hk{side}', f'hc{side}'); e(f'hc{side}', f'hp{side}')
    tail = [((0, 0.23, 0.235), 0.044), ((0, 0.34, 0.245), 0.04), ((0, 0.44, 0.285), 0.036), ((0, 0.50, 0.36), 0.032), ((0, 0.51, 0.44), 0.029), ((0, 0.49, 0.50), 0.026)]
    prev = 'pelvis'
    for i, (co, r) in enumerate(tail):
        v(f't{i}', co, (r, r))
        e(prev, f't{i}')
        prev = f't{i}'
    me = bpy.data.meshes.new('BodyMesh')
    me.from_pydata(verts, edges, [])
    ob = bpy.data.objects.new('Body', me)
    sc.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.modifier_add(type='SKIN')
    me = ob.data
    for i, r in enumerate(radii):
        me.skin_vertices[0].data[i].radius = r
    me.skin_vertices[0].data[SK['pelvis']].use_root = True
    skin = ob.modifiers['Skin']
    skin.branch_smoothing = 0.9
    skin.use_smooth_shade = True
    sub = ob.modifiers.new('Subsurf', 'SUBSURF')
    sub.levels = 2
    sub.render_levels = 2
    bpy.ops.object.modifier_apply(modifier='Skin')
    bpy.ops.object.modifier_apply(modifier='Subsurf')
    for p in ob.data.polygons:
        p.use_smooth = True
    assign(ob, FUR)
    return ob


body = skin_body()

# ------------------------------------------------------------------ the head: skull, muzzle, cheeks, ears, nose, eyes with lids, whiskers
HC = Vector((0, -0.285, 0.33))  # head centre
head_parts = []
skull = sphere('Skull', HC, (0.112, 0.104, 0.094), FUR_HEAD)
muzzle = sphere('Muzzle', HC + Vector((0, -0.085, -0.03)), (0.056, 0.052, 0.036), WHITE)
chin = sphere('Chin', HC + Vector((0, -0.07, -0.056)), (0.032, 0.032, 0.022), WHITE)
cheekL = sphere('CheekL', HC + Vector((-0.066, -0.04, -0.032)), (0.052, 0.052, 0.042), WHITE)
cheekR = sphere('CheekR', HC + Vector((0.066, -0.04, -0.032)), (0.052, 0.052, 0.042), WHITE)
nose = sphere('Nose', HC + Vector((0, -0.14, -0.012)), (0.016, 0.011, 0.011), NOSE, seg=16, rings=8)
head_parts += [skull, muzzle, chin, cheekL, cheekR, nose]
earL = earR = None
for side, sx in (('L', -1), ('R', 1)):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.055, radius2=0.005, depth=0.10)
    me = bpy.data.meshes.new(f'Ear{side}')
    bm.to_mesh(me)
    bm.free()
    ear = bpy.data.objects.new(f'Ear{side}', me)
    sc.collection.objects.link(ear)
    ear.location = HC + Vector((sx * 0.068, 0.012, 0.082))
    ear.rotation_euler = (math.radians(-6), math.radians(sx * 22), 0)
    ear.scale = (1.0, 0.45, 1.0)
    smooth(ear, 2)
    assign(ear, FUR_HEAD)
    inner = bpy.data.objects.new(f'EarIn{side}', me.copy())
    sc.collection.objects.link(inner)
    inner.location = ear.location + Vector((0, -0.012, -0.004))
    inner.rotation_euler = ear.rotation_euler
    inner.scale = (0.62, 0.25, 0.8)
    smooth(inner, 2)
    assign(inner, PINK)
    head_parts += [ear, inner]
    if side == 'L':
        earL = (ear, inner)
    else:
        earR = (ear, inner)

eyes = {}
for side, sx in (('L', -1), ('R', 1)):
    pos = HC + Vector((sx * 0.05, -0.082, 0.02))
    ball = sphere(f'Eye{side}', pos, (0.023, 0.023, 0.023), EYE_WHITE, seg=32, rings=16)
    iris = sphere(f'Iris{side}', pos + Vector((sx * -0.002, -0.0155, 0.0)), (0.0185, 0.0095, 0.0185), IRIS, seg=32, rings=16)
    pupil = sphere(f'Pupil{side}', pos + Vector((sx * -0.002, -0.0225, 0.0)), (0.0052, 0.0035, 0.0155), PUPIL, seg=16, rings=8)
    # eyelids: two half-shells hinged at the eye centre, closed by rotating about X
    lids = []
    for kind, flip in (('up', 1), ('lo', -1)):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1.0)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_inner=(flip == -1), clear_outer=(flip == 1))
        lm = bpy.data.meshes.new(f'Lid{kind}{side}')
        bm.to_mesh(lm)
        bm.free()
        lid = bpy.data.objects.new(f'Lid{kind}{side}', lm)
        sc.collection.objects.link(lid)
        lid.location = pos
        lid.scale = (0.0255, 0.0255, 0.0255)
        lid.rotation_euler = (math.radians(-112 if kind == 'up' else 112), 0, 0)
        for p in lm.polygons:
            p.use_smooth = True
        assign(lid, EYELID)
        lids.append(lid)
    eyes[side] = {'ball': ball, 'iris': iris, 'pupil': pupil, 'up': lids[0], 'lo': lids[1], 'pos': pos}
    head_parts += [ball, iris, pupil]

whiskers = []
for side, sx in (('L', -1), ('R', 1)):
    for k in range(3):
        crv = bpy.data.curves.new(f'Wh{side}{k}', 'CURVE')
        crv.dimensions = '3D'
        crv.bevel_depth = 0.0006
        sp = crv.splines.new('BEZIER')
        sp.bezier_points.add(2)
        base = HC + Vector((sx * 0.04, -0.12, -0.02 + k * 0.008))
        pts = [base, base + Vector((sx * 0.06, -0.02, 0.012 - k * 0.012)), base + Vector((sx * 0.12, -0.012, 0.0 - k * 0.028))]
        for bp, co in zip(sp.bezier_points, pts):
            bp.co = co
            bp.handle_left_type = bp.handle_right_type = 'AUTO'
        ob = bpy.data.objects.new(f'Wh{side}{k}', crv)
        sc.collection.objects.link(ob)
        assign(ob, WHISKER)
        whiskers.append(ob)
head_parts += whiskers

# ------------------------------------------------------------------ the rig
arm_data = bpy.data.armatures.new('CatRig')
arm = bpy.data.objects.new('CatRig', arm_data)
sc.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones
made = {}


def bone(name, parent, head, tail, connect=False):
    b = eb.new(name)
    b.head = Vector(head)
    b.tail = Vector(tail)
    if parent:
        b.parent = made[parent]
        b.use_connect = connect
    made[name] = b
    return b


bone('root', None, (0, 0, 0), (0, 0.1, 0))
bone('hips', 'root', (0, 0.17, 0.22), (0, 0.00, 0.225))
bone('spine', 'hips', (0, 0.00, 0.225), (0, -0.14, 0.24), True)
bone('neck', 'spine', (0, -0.14, 0.24), (0, -0.23, 0.29), True)
bone('head', 'neck', (0, -0.23, 0.29), (0, -0.285, 0.40), True)
bone('earL', 'head', (-0.068, -0.273, 0.41), (-0.09, -0.275, 0.50))
bone('earR', 'head', (0.068, -0.273, 0.41), (0.09, -0.275, 0.50))
for side, sx in (('L', -1), ('R', 1)):
    for kind, e in (('up', eyes[side]['up']), ('lo', eyes[side]['lo'])):
        p = eyes[side]['pos']
        bone(f'lid{kind}{side}', 'head', p, p + Vector((0, 0, 0.02)))
    p = eyes[side]['pos']
bone('jaw', 'head', (0, -0.26, 0.30), (0, -0.36, 0.29))
prev = 'hips'
tail_pts = [(0.23, 0.235), (0.34, 0.245), (0.44, 0.285), (0.50, 0.36), (0.51, 0.44), (0.49, 0.50), (0.46, 0.55)]
for i in range(len(tail_pts) - 1):
    a, b = tail_pts[i], tail_pts[i + 1]
    bone(f'tail{i}', prev, (0, a[0], a[1]), (0, b[0], b[1]), i > 0)
    prev = f'tail{i}'
legs = {}
for side, sx in (('L', -1), ('R', 1)):
    x = sx * 0.055
    # front leg
    bone(f'fup{side}', 'spine', (x, -0.10, 0.19), (x, -0.10, 0.105))
    bone(f'flo{side}', f'fup{side}', (x, -0.10, 0.105), (x, -0.11, 0.04), True)
    bone(f'fpaw{side}', f'flo{side}', (x, -0.11, 0.04), (x, -0.15, 0.012), True)
    bone(f'fik{side}', 'root', (x, -0.12, 0.03), (x, -0.12, 0.07))
    bone(f'fpole{side}', 'spine', (x, -0.02, 0.15), (x, -0.02, 0.21))
    x = sx * 0.065
    bone(f'hup{side}', 'hips', (x, 0.15, 0.185), (x, 0.11, 0.105))
    bone(f'hlo{side}', f'hup{side}', (x, 0.11, 0.105), (x, 0.19, 0.055), True)
    bone(f'hpaw{side}', f'hlo{side}', (x, 0.19, 0.055), (x, 0.17, 0.012), True)
    bone(f'hik{side}', 'root', (x, 0.175, 0.03), (x, 0.175, 0.07))
    bone(f'hpole{side}', 'hips', (x, 0.02, 0.10), (x, 0.02, 0.16))
bpy.ops.object.mode_set(mode='OBJECT')

# skin the body to the rig (automatic weights work well on this clean, smooth mesh)
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# the head parts ride on bones: the skull and face on the head, each ear on its bone, each lid on its lid bone
for ob in head_parts:
    ob.select_set(False)


def attach(ob, bone_name):
    ob.parent = arm
    if ob.type == 'MESH':
        vg = ob.vertex_groups.new(name=bone_name)
        vg.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
        mod = ob.modifiers.new('Armature', 'ARMATURE')
        mod.object = arm
        if len(ob.modifiers) > 1:
            ob.modifiers.move(len(ob.modifiers) - 1, 0)
    else:
        # curves (the whiskers) follow the head by plain bone parenting at the bone's head
        ob.parent_type = 'BONE'
        ob.parent_bone = bone_name
        m = arm.matrix_world @ arm.data.bones[bone_name].matrix_local @ Matrix.Translation((0, arm.data.bones[bone_name].length, 0))
        ob.matrix_parent_inverse = m.inverted()


for ob in (skull, muzzle, chin, cheekL, cheekR, nose, *whiskers):
    attach(ob, 'head')
attach(earL[0], 'earL'); attach(earL[1], 'earL')
attach(earR[0], 'earR'); attach(earR[1], 'earR')
for side in ('L', 'R'):
    for k in ('ball', 'iris', 'pupil'):
        attach(eyes[side][k], 'head')
    attach(eyes[side]['up'], f'lidup{side}')
    attach(eyes[side]['lo'], f'lidlo{side}')

# legs: IK from the knee-chain end to the foot target, with a pole to keep the knee pointing forward
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
for side in ('L', 'R'):
    for pre, lo in (('f', 'flo'), ('h', 'hlo')):
        pb = arm.pose.bones[f'{lo}{side}']
        ik = pb.constraints.new('IK')
        ik.target = arm
        ik.subtarget = f'{pre}ik{side}'
        ik.pole_target = arm
        ik.pole_subtarget = f'{pre}pole{side}'
        ik.pole_angle = math.radians(-90)
        ik.chain_count = 2
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('CAT BUILT', OUT)
