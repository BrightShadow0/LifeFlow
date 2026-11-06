# Model Lab · 2017 Ford GT

A standalone Three.js viewer built around the supplied 2017 Ford GT OBJ model and its original MTL materials and texture set. This page is separate from Experience Lab.

## Required model assets

Extract the contents of `FordGT-ModelLab-Assets.zip` into this folder so the page has this structure:

```
model-lab/
  index.html
  README.md
  assets/
    Ford GT (2017).obj
    Ford GT (2017).mtl
    *.png
```

Keep the OBJ, MTL, and referenced texture images together in `assets/`. The MTL file references its texture images by filename.

## Viewer controls

- Drag to orbit
- Scroll or pinch to zoom
- Right-drag to pan
- Front, side, rear, and top camera presets
- Auto-rotation toggle
- Reset camera

The viewer fits the imported model from its measured bounds. It does not generate replacement car geometry or add guide lines.

## Runtime

Uses Three.js 0.187.0 from jsDelivr and the OBJLoader, MTLLoader, and OrbitControls add-ons. Serve this directory over HTTP(S); opening the HTML as a local file may block module and asset loading.
