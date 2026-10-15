# Generates src/chem_molecules.json: 3D coordinates via RDKit (pip install rdkit)
import json
from rdkit import Chem
from rdkit.Chem import AllChem
M=[
("h2","Hydrogen","[H][H]","Linear","Nonpolar","The lightest and most abundant molecule in the universe. A clean fuel: burning it makes only water.","Rocket fuel, fertiliser (Haber process), fuel cells","gas"),
("o2","Oxygen","O=O","Linear","Nonpolar","Makes up 21% of air. A double bond joins the two atoms. Needed for cellular respiration.","Breathing, combustion, steelmaking, hospitals","gas"),
("n2","Nitrogen","N#N","Linear","Nonpolar","78% of air. The triple bond is one of the strongest, so N2 is very unreactive.","Fertiliser feedstock, food packaging, liquid-nitrogen cooling","gas"),
("cl2","Chlorine","ClCl","Linear","Nonpolar","A yellow-green toxic gas that is highly reactive. Two chlorine atoms share one pair of electrons.","Water disinfection, PVC plastic, bleach","gas"),
("o3","Ozone","[O-][O+]=O","Bent (117°)","Polar","Three oxygen atoms. In the stratosphere it absorbs harmful UV; at ground level it is a pollutant.","UV shield, water purification","gas"),
("h2o","Water","O","Bent (104.5°)","Polar","Two hydrogens bonded to one oxygen. The bent shape makes water polar, so molecules stick together with hydrogen bonds. This explains its high boiling point and its power as a solvent.","Solvent of life, 60% of the human body","liquid"),
("h2o2","Hydrogen peroxide","OO","Bent about the O-O bond","Polar","Like water with an extra oxygen. The weak O-O bond makes it a good oxidiser and it slowly decomposes to water and oxygen.","Antiseptic, hair bleach, rocket propellant","liquid"),
("co2","Carbon dioxide","O=C=O","Linear","Nonpolar (bonds are polar, but cancel)","Two C=O double bonds on opposite sides. It is produced by respiration and burning, and traps heat in the atmosphere.","Fizzy drinks, fire extinguishers, photosynthesis input","gas"),
("co","Carbon monoxide","[C-]#[O+]","Linear","Slightly polar","A toxic gas made when carbon burns without enough oxygen. It binds haemoglobin about 200 times more strongly than oxygen does.","Metallurgy, chemical synthesis","gas"),
("nh3","Ammonia","N","Trigonal pyramidal (107°)","Polar","Nitrogen with three hydrogens and one lone pair, which gives the pyramid shape. It is made industrially by the Haber-Bosch process.","Fertiliser, cleaning products, refrigeration","gas"),
("ch4","Methane","C","Tetrahedral (109.5°)","Nonpolar","The simplest hydrocarbon and the main part of natural gas. The four hydrogens point to the corners of a tetrahedron.","Natural-gas fuel, hydrogen production","gas"),
("hcl","Hydrogen chloride","Cl","Linear","Polar","A gas that dissolves in water to make hydrochloric acid, the acid in your stomach.","Stomach acid, steel pickling, chemical synthesis","gas"),
("h2s","Hydrogen sulfide","S","Bent (92°)","Polar","The smell of rotten eggs. Poisonous at higher concentrations.","Sulfur production, chemical analysis","gas"),
("so2","Sulfur dioxide","O=S=O","Bent (119°)","Polar","Released by volcanoes and burning coal. A cause of acid rain.","Food preservative, sulfuric-acid production","gas"),
("no2","Nitrogen dioxide","[O]N=O","Bent (134°)","Polar","A reddish-brown gas from vehicle engines. It has an unpaired electron so it is a radical.","Nitric-acid production; a smog pollutant","gas"),
("no","Nitric oxide","[N]=O","Linear","Polar","A radical gas that your body uses as a signalling molecule to relax blood vessels.","Blood-pressure regulation (biology)","gas"),
("h2so4","Sulfuric acid","OS(=O)(=O)O","Tetrahedral at sulfur","Polar","The most-produced industrial chemical. A strong acid that is also a powerful dehydrating agent.","Car batteries, fertiliser, refining","liquid"),
("hno3","Nitric acid","O[N+](=O)[O-]","Trigonal planar at nitrogen","Polar","A strong acid used to make fertilisers and explosives.","Fertiliser, explosives, etching","liquid"),
("ch3oh","Methanol","CO","Tetrahedral at carbon, bent at oxygen","Polar","The simplest alcohol. Toxic to drink.","Solvent, fuel, antifreeze, chemical feedstock","liquid"),
("c2h6","Ethane","CC","Tetrahedral at each carbon","Nonpolar","Two carbons joined by a single bond, each with three hydrogens.","Making ethylene, natural-gas component","gas"),
("c2h4","Ethene (ethylene)","C=C","Planar, trigonal at each carbon","Nonpolar","A double bond holds all six atoms in one plane. Plants release it to ripen fruit.","Polyethylene plastic, fruit ripening","gas"),
("c2h2","Ethyne (acetylene)","C#C","Linear","Nonpolar","A triple bond between two carbons. It burns at over 3000 °C in oxy-acetylene torches.","Welding, chemical synthesis","gas"),
("c2h5oh","Ethanol","CCO","Tetrahedral at carbon, bent at oxygen","Polar","The alcohol in drinks. It mixes with water because of its -OH group.","Beverages, fuel, disinfectant, solvent","liquid"),
("hcho","Formaldehyde","C=O","Trigonal planar","Polar","The simplest aldehyde, a pungent gas.","Preservative, resins and plastics","gas"),
("ch3cooh","Acetic acid","CC(=O)O","Trigonal planar at the carboxyl carbon","Polar","The acid in vinegar. The carboxyl group (-COOH) is the signature of organic acids.","Vinegar, plastics, solvents","liquid"),
("acetone","Acetone","CC(C)=O","Trigonal planar at the carbonyl carbon","Polar","A volatile solvent with a sweet smell.","Nail-polish remover, industrial solvent","liquid"),
("urea","Urea","NC(N)=O","Planar","Polar","The first organic compound made from inorganic starting materials (Wöhler, 1828). Mammals excrete excess nitrogen as urea.","Fertiliser, skin creams","solid"),
("benzene","Benzene","C1=CC=CC=C1","Planar hexagon","Nonpolar","A ring of six carbons with delocalised electrons shared around the ring, so every C-C bond is the same length.","Raw material for plastics, dyes, drugs","liquid"),
("glycine","Glycine","NCC(=O)O","Tetrahedral at carbon","Polar","The simplest amino acid, one of the building blocks of proteins.","Protein building block, supplement","solid"),
("glucose","Glucose","OCC1OC(O)C(O)C(O)C1O","Six-membered ring (chair)","Polar","The main sugar your cells burn for energy, made by plants in photosynthesis.","Energy source, intravenous drips","solid"),
("caffeine","Caffeine","Cn1cnc2c1c(=O)n(C)c(=O)n2C","Two fused planar rings","Polar","The world's most used stimulant. It blocks adenosine receptors in the brain, which delays sleepiness.","Coffee, tea, energy drinks","solid"),
("aspirin","Aspirin (acetylsalicylic acid)","CC(=O)Oc1ccccc1C(=O)O","Planar ring with two side groups","Polar","A pain reliever and anti-inflammatory. It blocks the enzyme that makes prostaglandins.","Pain, fever, heart-attack prevention","solid"),
("ibuprofen","Ibuprofen","CC(C)Cc1ccc(cc1)C(C)C(=O)O","Planar ring with branched side chains","Mostly nonpolar","An anti-inflammatory painkiller (NSAID).","Pain, fever, inflammation","solid"),
("vitc","Vitamin C (ascorbic acid)","OCC(O)C1OC(=O)C(O)=C1O","Five-membered ring","Polar","An antioxidant that your body cannot make. It is needed to build collagen.","Prevents scurvy, supplements","solid"),
]
out=[]
for id_,name,smi,shape,pol,desc,uses,state in M:
    m=Chem.AddHs(Chem.MolFromSmiles(smi))
    ok=AllChem.EmbedMolecule(m,randomSeed=7)
    if ok!=0: ok=AllChem.EmbedMolecule(m,randomSeed=7,useRandomCoords=True)
    if ok!=0:
        print('EMBED FAIL',id_); continue
    try: AllChem.MMFFOptimizeMolecule(m,maxIters=2000)
    except Exception: pass
    Chem.Kekulize(m,clearAromaticFlags=True)
    conf=m.GetConformer()
    # centre
    xs=[list(conf.GetAtomPosition(i)) for i in range(m.GetNumAtoms())]
    cx=[sum(p[k] for p in xs)/len(xs) for k in range(3)]
    atoms=[[a.GetSymbol(),round(xs[i][0]-cx[0],3),round(xs[i][1]-cx[1],3),round(xs[i][2]-cx[2],3)] for i,a in enumerate(m.GetAtoms())]
    bonds=[[b.GetBeginAtomIdx(),b.GetEndAtomIdx(),int(b.GetBondTypeAsDouble())] for b in m.GetBonds()]
    out.append(dict(id=id_,name=name,smiles=smi,shape=shape,polarity=pol,desc=desc,uses=uses,state=state,atoms=atoms,bonds=bonds))
json.dump(out,open('/home/claude/anatomy/src/chem_molecules.json','w'),separators=(',',':'))
print(len(out),'molecules', sum(len(o['atoms']) for o in out),'atoms')
