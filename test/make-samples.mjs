// Generates small sample models in test/samples to try every loader.
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';
import { zipSync, strToU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { mkdir, writeFile } from 'node:fs/promises';

globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0); // PLYExporter expects a browser
const out = 'test/samples';
await mkdir(out, { recursive: true });

// Z-up print-style scene: a knot, a plate and a post, in mm.
function parts() {
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(20, 6, 160, 24).rotateX(Math.PI / 2).translate(0, 0, 28), new THREE.MeshStandardMaterial());
  const plate = new THREE.Mesh(new THREE.BoxGeometry(80, 80, 4).translate(0, 0, 2), new THREE.MeshStandardMaterial());
  const post = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 30, 32).rotateX(Math.PI / 2).translate(30, 30, 19), new THREE.MeshStandardMaterial());
  return [knot, plate, post];
}

const scene = new THREE.Scene();
parts().forEach((m) => scene.add(m));
scene.updateMatrixWorld(true);

await writeFile(`${out}/scene.stl`, Buffer.from(new STLExporter().parse(scene, { binary: true }).buffer));
await writeFile(`${out}/scene-ascii.stl`, new STLExporter().parse(scene));

// A spur gear with a bore and a keyway: a typical print-style part with sharp edges and curved holes.
{
  const teeth = 18, rOuter = 32, rRoot = 26;
  const shape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const step = (Math.PI * 2) / teeth;
    const pts = [[rRoot, a], [rOuter, a + step * 0.2], [rOuter, a + step * 0.5], [rRoot, a + step * 0.7]];
    for (const [r, ang] of pts) {
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      if (i === 0 && r === rRoot && ang === a) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, 9, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  for (let k = 0; k < 4; k++) { // lightening holes
    const h = new THREE.Path();
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    h.absarc(Math.cos(a) * 17, Math.sin(a) * 17, 4.2, 0, Math.PI * 2, true);
    shape.holes.push(h);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 10, bevelEnabled: true, bevelSize: 0.6, bevelThickness: 0.6, bevelSegments: 2, curveSegments: 32 });
  const gear = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  const s = new THREE.Scene();
  s.add(gear);
  s.updateMatrixWorld(true);
  await writeFile(`${out}/gear.stl`, Buffer.from(new STLExporter().parse(s, { binary: true }).buffer));
}

// OBJ with three named objects and an MTL
const objScene = new THREE.Scene();
const names = ['Knot', 'Plate', 'Post'];
const mats = ['red', 'grey', 'green'];
parts().forEach((m, i) => { m.name = names[i]; objScene.add(m); });
objScene.updateMatrixWorld(true);
let obj = new OBJExporter().parse(objScene);
// OBJExporter writes "o name" blocks; add material references.
let idx = 0;
obj = obj.replace(/^o (\w+)$/gm, (_m, n) => `o ${n}\nusemtl ${mats[idx++]}`);
await writeFile(`${out}/scene.obj`, `mtllib scene.mtl\n${obj}`);
await writeFile(`${out}/scene.mtl`, [
  'newmtl red\nKd 0.9 0.2 0.2\nmap_Kd missing.png',
  'newmtl grey\nKd 0.6 0.6 0.65',
  'newmtl green\nKd 0.2 0.8 0.3',
].join('\n\n'));

// PLY with vertex colors
const ballGeo = new THREE.IcosahedronGeometry(20, 3);
const colors = [];
const p = ballGeo.attributes.position;
for (let i = 0; i < p.count; i++) colors.push((p.getX(i) + 20) / 40, (p.getY(i) + 20) / 40, (p.getZ(i) + 20) / 40);
ballGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
const ball = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ vertexColors: true }));
await writeFile(`${out}/ball-colors.ply`, Buffer.from(await new Promise((res) => new PLYExporter().parse(ball, res, { binary: true }))));

// 3MF: two build items (a cube and a pyramid), one with a base color
const cubeVerts = [[0,0,0],[20,0,0],[20,20,0],[0,20,0],[0,0,20],[20,0,20],[20,20,20],[0,20,20]];
const cubeTris = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
const obj3mf = (id, verts, tris, pid) => `<object id="${id}" type="model"${pid ? ` pid="1" pindex="${pid - 1}"` : ''}><mesh><vertices>${verts.map((v) => `<vertex x="${v[0]}" y="${v[1]}" z="${v[2]}"/>`).join('')}</vertices><triangles>${tris.map((t) => `<triangle v1="${t[0]}" v2="${t[1]}" v3="${t[2]}"/>`).join('')}</triangles></mesh></object>`;
const pyr = [[0,0,0],[20,0,0],[20,20,0],[0,20,0],[10,10,25]];
const pyrTris = [[0,2,1],[0,3,2],[0,1,4],[1,2,4],[2,3,4],[3,0,4]];
const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><basematerials id="1"><base name="Orange" displaycolor="#FF8800FF"/><base name="Blue" displaycolor="#2266DDFF"/></basematerials>${obj3mf(2, cubeVerts, cubeTris, 1)}${obj3mf(3, pyr, pyrTris, 2)}</resources><build><item objectid="2"/><item objectid="3" transform="1 0 0 0 1 0 0 0 1 35 0 0"/></build></model>`;
const zip = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
  '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
  '3D/3dmodel.model': strToU8(model),
});
await writeFile(`${out}/two-parts.3mf`, Buffer.from(zip));

console.log('samples written to', out);
