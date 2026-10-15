import bpy, pickle, numpy as np, time
t0=time.time()
bpy.ops.wm.open_mainfile(filepath='/tmp/za/x/Z-Anatomy/Startup.blend')
paths={}
def walk(c,path):
    for o in c.objects: paths.setdefault(o.name,[]).append(path)
    for ch in c.children: walk(ch,path+'/'+ch.name)
walk(bpy.context.scene.collection,'')
def sysof(name):
    tops=set(); subs=set()
    for p in paths.get(name,[]):
        parts=p.split('/')[1:]
        if not parts: continue
        tops.add(parts[0])
        if parts[0]=='Bonus collection' and len(parts)>1: subs.add(parts[1])
    for key,s in [('1:','bone'),('4:','muscle'),('5:','cv'),('7:','nerve'),('8:','visc'),('6:','lymph'),('9:','skin'),('2:','ins'),('3:','joint'),('Reference','ref'),('Cross','ref')]:
        if any(t.startswith(key) for t in tops): return s
    m={'Skeletal system':'bone','Muscular system':'muscle','Cardiovascular system':'cv','Nervous system':'nerve','Visceral systems':'visc','Regions of human body':'skin'}
    for s in subs:
        if s in m: return m[s]
    return 'other'
dg=bpy.context.evaluated_depsgraph_get()
out=[]; skipped=0
for o in bpy.data.objects:
    if o.type not in ('MESH','CURVE'): continue
    if o.name not in paths or o.hide_get() or o.hide_viewport: continue
    s=sysof(o.name)
    if s=='lymph' and not __import__('re').match(r'(spleen|thymus)',o.name,__import__('re').I): continue
    if s not in ('bone','muscle','cv','nerve','visc','skin','lymph'): continue
    try:
        ev=o.evaluated_get(dg); me=ev.to_mesh()
    except Exception as e:
        skipped+=1; continue
    if me is None or len(me.polygons)==0:
        ev.to_mesh_clear(); continue
    me.calc_loop_triangles()
    nv=len(me.vertices); V=np.empty(nv*3,np.float32); me.vertices.foreach_get('co',V); V=V.reshape(-1,3)
    nt=len(me.loop_triangles); F=np.empty(nt*3,np.int32); me.loop_triangles.foreach_get('vertices',F); F=F.reshape(-1,3)
    M=np.array(o.matrix_world,dtype=np.float64)
    W=(V.astype(np.float64)@M[:3,:3].T+M[:3,3]).astype(np.float32)
    out.append(dict(name=o.name,sys=s,kind=o.type,V=W,F=F))
    ev.to_mesh_clear()
pickle.dump(out,open('/tmp/za/dump.pkl','wb'),protocol=4)
import collections
c=collections.Counter((x['sys'],x['kind']) for x in out); print(c, 'skipped',skipped)
print({k:int(sum(len(x['F']) for x in out if (x['sys'],x['kind'])==k)) for k in c})
print('time',time.time()-t0)
