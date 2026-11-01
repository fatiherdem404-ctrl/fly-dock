# Renders a few views of a built pet, for checking the model: blender -b file.blend --python preview.py -- <outdir> [size]
import bpy, sys, math, os
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:]
OUT = ARGS[0]
SIZE = int(ARGS[1]) if len(ARGS) > 1 else 640
bpy.ops.wm.open_mainfile(filepath=ARGS[2]) if len(ARGS) > 2 else None
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.render.film_transparent = False
sc.render.resolution_x = SIZE
sc.render.resolution_y = SIZE
sc.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('W')
sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.69, 0.80, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 0.7
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 2.4
sun.rotation_euler = (math.radians(50), math.radians(-12), math.radians(-35))
sc.collection.objects.link(sun)
fill = bpy.data.objects.new('Fill', bpy.data.lights.new('Fill', 'SUN'))
fill.data.energy = 0.8
fill.rotation_euler = (math.radians(65), math.radians(20), math.radians(140))
sc.collection.objects.link(fill)
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 1.2
cam = bpy.data.objects.new('cam', cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
centre = Vector((0, 0.1, 0.33))
views = {'side': (-1, 0, 0.1), 'threeq': (-0.85, -0.55, 0.2), 'front': (0, -1, 0.15)}
for name, d in views.items():
    v = Vector(d).normalized()
    cam.location = centre + v * 4
    cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)
print('PREVIEW DONE')
