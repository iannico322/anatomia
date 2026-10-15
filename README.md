# Anatomia – 3D human atlas

Open `index.html` (double-click, works from `file://`). Switch Male/Female (or press G). Peel the body from skin → muscle → organs → skeleton, click any structure
(2,000+ real parts), search, isolate, and zoom down to tissue / cell / organelle level.

## Models & license
Anatomy meshes come from **Z-Anatomy** / **BodyParts3D** (© The Database Center for Life Science, CC BY-SA 4.0),
decimated and repacked here. The derived models in `models/` and `data/` are therefore also **CC BY-SA 4.0**.
https://www.z-anatomy.com · https://creativecommons.org/licenses/by-sa/4.0/

## Layout
- `index.html`, `app.js` – the viewer (app.js is the esbuild bundle of `src/`)
- `data/*.js` – models embedded as base64 scripts (so it runs without a server)
- `models/*.glb` – the same models as meshopt-compressed GLB
- `src/` – source (`real.js` loader/materials, `main.js` UI, `cells.js` cell scenes, `descriptions.js`)
- `tools/` – Blender/Python pipeline used to extract and simplify the meshes

Rebuild: `npm install && bash build.sh`. Educational use only, not medical advice.

## Female option
The source atlas is a male body. The female view is the same anatomy reshaped by a smooth warp (narrower shoulders and ribcage, wider pelvis, bust and hips on the skin)
plus procedurally modelled uterus, ovaries, fallopian tubes and vagina. It is an illustrative morph, not a separate scan.

## Learning tools
- **Parts list**: select an organ (heart, brain, lungs, liver, eyes) to list its parts. Hover to highlight, click to zoom, and use the Explode slider.
- **Guided tour**: nine stops from skin to cells.
- **Quiz**: 10 "click the structure" questions by category, with hints and a score.
- **Label sheet**: opens a printable worksheet and answer key for the current view.
