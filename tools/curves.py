import bpy, json, collections
bpy.ops.wm.open_mainfile(filepath='/tmp/za/x/Z-Anatomy/Startup.blend')
c=collections.Counter(o.type for o in bpy.data.objects); print(c)
paths={}
def walk(col,path):
    for o in col.objects: paths.setdefault(o.name,[]).append(path)
    for ch in col.children: walk(ch,path+'/'+ch.name)
walk(bpy.context.scene.collection,'')
cur=[]
for o in bpy.data.objects:
    if o.type in ('CURVE','SURFACE','FONT','META'):
        d=o.data
        cur.append(dict(name=o.name,type=o.type,hide=o.hide_get() or o.hide_viewport,paths=paths.get(o.name,[]),bevel=getattr(d,'bevel_depth',0),mods=len(o.modifiers),dim=[round(x,3) for x in o.dimensions]))
json.dump(cur,open('/tmp/za/curves.json','w')); print(len(cur))
