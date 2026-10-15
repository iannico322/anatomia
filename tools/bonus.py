import bpy, json
bpy.ops.wm.open_mainfile(filepath='/tmp/za/x/Z-Anatomy/Startup.blend')
out={}
def walk(c,path):
    L=[(o.name,len(o.data.polygons)) for o in c.objects if o.type=='MESH' and len(o.data.polygons)>0 and not o.hide_get()]
    out[path]=L
    for ch in c.children: walk(ch,path+'/'+ch.name)
walk(bpy.context.scene.collection,'')
json.dump(out,open('/tmp/za/tree.json','w'))
