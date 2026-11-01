# Builds a bone rig for a static pet model and weights the mesh to it, by geometry, without any manual painting.
# Used from render.py (run inside Blender: blender -b model.blend --python render.py -- <animal>).
import bpy
import numpy as np
from mathutils import Vector, Matrix


def smooth(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def seg_dist(p, a, b):
    """Distance from every point in p (n,3) to the segment a-b."""
    a = np.array(a, dtype=np.float32)
    b = np.array(b, dtype=np.float32)
    ab = b - a
    t = np.clip(((p - a) @ ab) / max(float(ab @ ab), 1e-9), 0.0, 1.0)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)


def make_armature(bones):
    """bones: list of (name, parent or None, head, tail). Returns the armature object."""
    arm_data = bpy.data.armatures.new('PetRig')
    arm = bpy.data.objects.new('PetRig', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    made = {}
    for name, parent, head, tail in bones:
        b = arm_data.edit_bones.new(name)
        b.head = Vector(head)
        b.tail = Vector(tail)
        if parent:
            b.parent = made[parent]
        made[name] = b
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def apply_weights(body, arm, weights):
    """weights: dict bone name -> (n,) array of influence; they are normalised per vertex and written as vertex groups."""
    names = list(weights.keys())
    stack = np.stack([weights[n] for n in names], axis=1).astype(np.float32)
    total = stack.sum(axis=1, keepdims=True)
    total[total < 1e-6] = 1.0
    stack /= total
    for n in names:
        body.vertex_groups.new(name=n)
    groups = [body.vertex_groups[n] for n in names]
    for j, g in enumerate(groups):
        col = stack[:, j]
        idx = np.nonzero(col > 0.01)[0]
        # group vertices by (rounded) weight to keep the number of calls small
        for i in idx:
            g.add([int(i)], float(col[i]), 'REPLACE')
    body.parent = arm
    mod = body.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm


def vertex_coords(body):
    n = len(body.data.vertices)
    co = np.empty(n * 3, dtype=np.float32)
    body.data.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)
