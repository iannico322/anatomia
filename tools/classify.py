import bpy, json
bpy.ops.wm.open_mainfile(filepath='/tmp/za/x/Z-Anatomy/Startup.blend')
paths={}
def walk(c,path):
    for o in c.objects:
        if o.type=='MESH': paths.setdefault(o.name,[]).append(path)
    for ch in c.children: walk(ch,path+'/'+ch.name)
walk(bpy.context.scene.collection,'')
out=[]
for o in bpy.data.objects:
    if o.type!='MESH' or o.name not in paths: continue
    n=len(o.data.polygons)
    out.append(dict(name=o.name,polys=n,hide=o.hide_get() or o.hide_viewport,paths=paths[o.name],dim=[round(x,3) for x in o.dimensions],mods=len(o.modifiers)))
json.dump(out,open('/tmp/za/objs.json','w'))
print(len(out))
