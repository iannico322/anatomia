# Generates src/chem/elements.json from the `mendeleev` package (pip install mendeleev)
import json, collections
from mendeleev import get_all_elements
out=[]
for e in get_all_elements():
    iso=[i for i in e.isotopes]
    stable=sorted(i.mass_number for i in iso if not i.is_radioactive)
    known=sorted(i.mass_number for i in iso)
    try: en=e.electronegativity_pauling()
    except Exception: en=None
    out.append(dict(z=e.atomic_number,sym=e.symbol,name=e.name,mass=round(float(e.atomic_weight),4) if e.atomic_weight else None,
      group=e.group_id,period=e.period,block=e.block,series=e.series,econf=e.econf if isinstance(e.econf,str) else None,
      mp=e.melting_point,bp=e.boiling_point,dens=e.density,en=en,lat=e.lattice_structure,latc=e.lattice_constant,
      disc=e.discoverers,year=e.discovery_year,color=e.jmol_color,rcov=e.covalent_radius_pyykko,rvdw=e.vdw_radius,
      oxi=e.oxistates,rad=bool(e.is_radioactive),desc=e.description,uses=e.uses,stable=stable,known=[known[0],known[-1]] if known else [],
      iso=[(i.mass_number,round(i.abundance,3) if i.abundance else 0) for i in iso if i.abundance]))
out.sort(key=lambda d:d['z'])
print(len(out), collections.Counter(d['series'] for d in out))
json.dump(out,open('/home/claude/anatomy/src/chem_elements.json','w'),separators=(',',':'),default=str)
