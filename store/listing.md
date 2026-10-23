# Microsoft Store listing: text to paste into Partner Center

Everything below is ready to copy into the matching field. Each block is checked against Microsoft's limits
(see `docs/MICROSOFT-STORE.md`). Do not add URLs or HTML to the description: Partner Center has separate fields for links.

Images: `store/screenshots/` (six 1920 × 1080 PNGs) and `store/assets/app-tile-icon-300x300.png`.

## Product name (reserve this first)

```
Simple 3D Viewer
```

If the name is taken, reserve a close alternative (for example "Simple 3D Model Viewer") and set the same name in
`build.appx.displayName` in `package.json`.

## Short description (Supplemental fields, max 1000, shown part ~270)

```
A small, fast and private 3D model viewer. Open STL, OBJ, 3MF and more, turn the model in any direction, zoom, and use colors and display modes to see every shape clearly. Works fully offline.
```

## Description (required, max 10,000 characters, plain text)

```
Simple 3D Viewer opens your 3D models and lets you look at them from every side. No account, no cloud and no internet connection are needed. Double-click a file, turn it around, done.

It was made for 3D printing: it opens the file types that slicers use and shows the real size of your model, so you can check a part before you print it.

OPEN THE FILES YOU ALREADY HAVE
STL (binary and text), OBJ with its material file, 3MF, PLY, AMF, GLB and glTF, FBX and Collada. Drag a file onto the window, use the Open button, or choose Simple 3D Viewer with "Open with". Step to the next or previous model in the same folder with the arrow keys.

TURN IT ANY DIRECTION
Rotate freely with the left mouse button, move the view with the right button, and zoom with the mouse wheel. Standard views (front, back, left, right, top, bottom and isometric) are one key press away. Zoom in and out with the plus and minus buttons and read the zoom level as a percentage.

SEE THE SHAPE CLEARLY
Shapes that look alike are easy to confuse in a single color. Paint the model in a color you choose, give every part of the file its own color, or use the colors stored in the file. Switch between solid, edges, wireframe, x-ray and normals display, and between smooth and flat shading. Choose a dark, gray or light background, or any color you like.

KNOW YOUR MODEL
The size of the model in millimeters, the number of triangles and the number of parts are always visible. A measured grid and an axis indicator help you keep your bearings, and the Z axis points up like it does in a slicer.

SIMPLE AND PRIVATE
Everything happens on your PC. The app collects no data and sends nothing anywhere. Your settings are remembered the next time you start it. Save the current view as a PNG picture whenever you like.

Simple 3D Viewer is free to use, including at work. The source code is public.
```

## Product features (max 20, each max 200 characters)

```
Opens STL, OBJ, 3MF, PLY, AMF, GLB, glTF, FBX and Collada files
Rotate in any direction, pan and zoom with the mouse
Zoom buttons with a percentage readout
One-key standard views: front, back, left, right, top, bottom, isometric
Single color, a color per part, or the colors stored in the file
Solid, edges, wireframe, x-ray and normals display modes
Smooth or flat shading, shadows, and a measured grid
Shows model size in millimeters, triangle count and parts
Step through the models in a folder with the arrow keys
Save the current view as a PNG picture
Works fully offline, no account, no data collected
Registers as a viewer for 3D files, so "Open with" works from File Explorer
```

## Search terms (up to 7)

```
3D viewer
STL viewer
OBJ viewer
3MF viewer
3D printing
3D model viewer
STL file
```

## Screenshot captions (max 200 characters each)

| File | Caption |
| --- | --- |
| `01-open-and-view.png` | Open a model and look at it from every side, with real dimensions and a measured grid. |
| `02-edges-and-flat-shading.png` | Show sharp edges and flat shading to check the shape of a part. |
| `03-wireframe.png` | Wireframe view shows every triangle of the mesh. |
| `04-color-per-part.png` | Give every part its own color to tell shapes apart. |
| `05-xray-light-background.png` | X-ray display on a light background reveals hidden shapes. |
| `06-colors-from-3mf-file.png` | Use the colors stored in the file, here from a 3MF. |

## Properties tab

| Field | Suggested value |
| --- | --- |
| Category | Pick the closest to design or graphics. "Photo & video" or "Productivity" both fit. Any is fine. |
| Privacy policy URL | `https://github.com/NickyVerslycken/Simple-3D-Viewer/blob/main/PRIVACY.md` |
| Website | `https://github.com/NickyVerslycken/Simple-3D-Viewer` |
| Support contact info | `https://github.com/NickyVerslycken/Simple-3D-Viewer/issues` |
| Copyright and trademark info | `© 2026 Nicky Verslycken` |
| Additional license terms | Paste the whole text of the `LICENSE` file (PolyForm Shield 1.0.0 with the "Required Notice" line). |
| Minimum hardware | Windows 10 or 11, 64-bit. A graphics card or chip with WebGL support. |
| Recommended hardware | A dedicated or modern integrated GPU for very large models. |

## Pricing and availability

- Price: **Free**. No free trial needed.
- Markets: all (default).
- Visibility: Public, publish as soon as certified.

## Age rating (IARC questionnaire)

Answer **No** to the violence, sexual content, language, gambling, drugs, user-to-user communication and
location questions. The app only displays files the user opens on their own PC.

## Notes for certification (visible only to the Microsoft testers)

```
Simple 3D Viewer is a local viewer for 3D model files. No account, sign-in or internet connection is needed, and the app does not use the network.

To test: start the app and drag in, or use Open to choose, any of the sample models from https://github.com/NickyVerslycken/Simple-3D-Viewer/tree/main/examples (gear.stl, two-parts.3mf, knot-assembly.obj with knot-assembly.mtl in the same folder). Rotate with the left mouse button, zoom with the wheel, and try the Color, Display and Shading settings in the right-hand panel.

The package declares the runFullTrust capability because it is an Electron (Chromium) desktop app packaged as a full-trust Win32 application. It only reads the model file the user chooses (and, for OBJ, the material and texture files next to it).
```

## runFullTrust justification (if Partner Center asks for it)

```
The app is an Electron desktop application (a packaged Win32 process) and must run full trust. It only reads the 3D model files that the user opens and stores its own settings. It does not access the network, personal data or other apps.
```
