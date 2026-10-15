import bpy, collections
bpy.ops.wm.open_mainfile(filepath='/tmp/za/x/Z-Anatomy/Startup.blend')
objs=[o for o in bpy.data.objects]
print('objects',len(objs), 'meshes', sum(o.type=='MESH' for o in objs))
tot=sum(len(o.data.polygons) for o in objs if o.type=='MESH'); print('total polys',tot)
cols=collections.OrderedDict()
def walk(c,d=0):
    n=sum(1 for o in c.objects if o.type=='MESH')
    print('  '*d+c.name, n, len(c.children))
    if d<2:
        for ch in c.children: walk(ch,d+1)
walk(bpy.context.scene.collection)
