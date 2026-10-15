import pickle, re, json, numpy as np, trimesh, fast_simplification as fs, collections, sys
d=pickle.load(open('/tmp/za/dump.pkl','rb'))
EXC_NERVE=re.compile(r'sulcus|sulci|tract\b|fasciculus|horn of|substance|funiculus|Lat_Fis|canal|ganglia|Choroid|Interpeduncular|root of|Aqueduct|commissure|Habenula|geniculate|colliculus|peduncle|Mamillary|Olive|Pineal|nucleus (of|ambiguus|proprius)|^ ?(Anterior|Posterior|Accessory|Motor|Inferior|Superior) (cochlear|salivatory|nucleus)|Intermedio|fossa|Cochlear nerve|Auditory tube|Lacrimal|Nasolacrimal|Ampulla|Central lobule|Ventricle|ventricle|Spinal dura',re.I)
KEEP_NERVE=re.compile(r'caudate|lentiform|globus|amygdal|hippocamp|corpus callosum|fornix|hypothalam',re.I)
EXC_ALL=re.compile(r'^\?|HOW TO|\.t$|fascia|bursa|septum|retinaculum|omentum|mesocolon|meso-appendix|pleura|peritoneum|penis|testis|epididymis|prostate|seminal|ductus deferens|ejaculatory|gingiva|taenia|mucosa of nasal|sheath of|\(Iliopectineal',re.I)
def rot(V):  # blender z-up -> gltf y-up (+z toward viewer)
    return np.stack([V[:,0],V[:,2],-V[:,1]],1)
def clean(n): return re.sub(r'\.(l|r|t)$','',n).strip()
def side(n):
    m=re.search(r'\.(l|r)$',n); return m.group(1) if m else ''
# --- assign target groups
items=[]
for x in d:
    n=x['name']
    if EXC_ALL.search(n): continue
    s,k=x['sys'],x['kind']
    if s=='bone': g='skeleton'
    elif s=='muscle': g='muscle'
    elif s=='skin': g='skin'
    elif s=='cv': g='heart' if k=='MESH' else 'vessels'
    elif s=='nerve':
        if k=='CURVE': g='nerves'
        else:
            if EXC_NERVE.search(n) and not KEEP_NERVE.search(n): continue
            g='brain'
    elif s in ('visc','lymph'): g='organs'
    else: continue
    if x['F'].shape[0]==0: continue
    items.append((g,x))
# shift from skeleton bbox
bone=np.concatenate([rot(x['V']) for g,x in items if g=='skeleton'])
mn,mx=bone.min(0),bone.max(0)
shift=np.array([(mn[0]+mx[0])/2, -mn[1], (mn[2]+mx[2])/2],np.float32)
print('bone bbox',mn,mx,'shift',shift)
BUDGET={'skeleton':300000,'muscle':400000,'vessels':300000,'nerves':160000,'brain':170000,'heart':110000,'organs':120000,'skin':60000}
tot=collections.Counter(); 
for g,x in items: tot[g]+=len(x['F'])
print('input tris',dict(tot))
manifest={'shift':shift.tolist(),'parts':[]}
scenes={g:trimesh.Scene() for g in BUDGET}
used=set(); outc=collections.Counter()
for g,x in items:
    V=rot(x['V'])-shift; F=x['F']
    # weld
    tm=trimesh.Trimesh(V,F,process=False); tm.merge_vertices(digits_vertex=5); tm.update_faces(tm.nondegenerate_faces()); tm.remove_unreferenced_vertices()
    V,F=np.asarray(tm.vertices),np.asarray(tm.faces)
    if len(F)==0: continue
    ratio=min(1.0,BUDGET[g]/tot[g])
    n=len(F); floor=260 if x['kind']=='CURVE' else 140; tgt=max(min(n,floor),int(n*ratio))
    if g=='skin': tgt=max(min(n,120),int(n*ratio))
    if tgt<n:
        try:
            r=1-tgt/n
            V2,F2=fs.simplify(V.astype(np.float32),F.astype(np.int32),target_reduction=min(r,.97))
            if len(F2)>=4: V,F=V2,F2
        except Exception as e: print('simp fail',x['name'],e)
    m=trimesh.Trimesh(V,F,process=False)
    m.vertex_normals
    name=x['name']
    base=name; i=1
    while base in used: i+=1; base=f'{name}#{i}'
    used.add(base)
    pid=f'p{len(manifest["parts"])}'
    scenes[g].add_geometry(m,node_name=pid,geom_name=pid)
    c=(V.min(0)+V.max(0))/2
    manifest['parts'].append(dict(id=pid,full=base,name=clean(name),side=side(name),layer=g,sys=x['sys'],kind=x['kind'],tris=int(len(F)),c=[round(float(v),4) for v in c],size=[round(float(v),4) for v in (V.max(0)-V.min(0))]))
    outc[g]+=len(F)
print('output tris',dict(outc))
for g,sc in scenes.items():
    if len(sc.geometry)==0: continue
    data=sc.export(file_type='glb',include_normals=True)
    open(f'/tmp/za/out/{g}.glb','wb').write(data); print(g,len(sc.geometry),len(data)/1e6,'MB')
json.dump(manifest,open('/tmp/za/out/manifest.json','w'))
