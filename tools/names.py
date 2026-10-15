import bpy, json
bpy.ops.wm.open_mainfile(filepath='/tmp/za/x/Z-Anatomy/Startup.blend')
out={}
for c in bpy.context.scene.collection.children:
    L=[]
    for o in c.objects:
        if o.type=='MESH':
            d=o.dimensions; L.append([o.name,len(o.data.polygons),[round(v,3) for v in o.location],[round(v,3) for v in d],len(o.modifiers),o.hide_get(), o.hide_viewport])
    out[c.name]=L
json.dump(out,open('/tmp/za/names.json','w'))
# overall bbox
import mathutils
mn=[1e9]*3; mx=[-1e9]*3
for o in bpy.context.scene.objects:
    if o.type=='MESH':
        for v in o.bound_box:
            w=o.matrix_world@mathutils.Vector(v)
            for i in range(3): mn[i]=min(mn[i],w[i]); mx[i]=max(mx[i],w[i])
print('bbox',mn,mx, 'unit', bpy.context.scene.unit_settings.scale_length)
