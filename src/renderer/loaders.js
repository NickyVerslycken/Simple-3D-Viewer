import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { AMFLoader } from 'three/examples/jsm/loaders/AMFLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';

export const EXTENSIONS = ['stl', 'obj', '3mf', 'ply', 'amf', 'glb', 'gltf', 'fbx', 'dae'];

// Print-oriented formats are Z-up; the glTF/FBX/Collada world is Y-up.
const Z_UP = new Set(['stl', 'obj', '3mf', 'ply', 'amf']);
export const defaultZUp = (ext) => Z_UP.has(ext);

export const extOf = (name) => {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
};

const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' };

const textOf = (buf) => new TextDecoder().decode(buf);
const wrap = (...objs) => {
  const g = new THREE.Group();
  g.add(...objs);
  return g;
};
const baseMaterial = (opts = {}) =>
  new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.55, metalness: 0.08, ...opts });

/**
 * Parses a model file into a three.js object.
 * @param name          file name (the extension picks the loader)
 * @param buf           ArrayBuffer with the file contents
 * @param readSibling   async (relativePath) => Uint8Array | null, for .mtl files and textures next to the model
 * @returns {{root: THREE.Object3D, ext: string, hasMaterials: boolean}}
 */
export async function parseModel(name, buf, readSibling = async () => null) {
  const ext = extOf(name);
  switch (ext) {
    case 'stl': {
      const geometry = new STLLoader().parse(buf);
      const colored = !!geometry.attributes.color;
      return { ext, hasMaterials: colored, root: wrap(new THREE.Mesh(geometry, baseMaterial({ vertexColors: colored }))) };
    }
    case 'ply': {
      const geometry = new PLYLoader().parse(buf);
      const colored = !!geometry.attributes.color;
      const root = geometry.index
        ? wrap(new THREE.Mesh(geometry, baseMaterial({ vertexColors: colored })))
        : wrap(new THREE.Points(geometry, new THREE.PointsMaterial({ vertexColors: colored, size: 1 })));
      return { ext, hasMaterials: colored, root };
    }
    case 'obj': {
      const text = textOf(buf);
      const loader = new OBJLoader();
      let hasMaterials = false;
      const mtlName = /^mtllib\s+(.+)$/m.exec(text)?.[1].trim();
      if (mtlName) {
        const mtlData = await readSibling(mtlName);
        if (mtlData) {
          // Textures are not loaded; keep just the material colors.
          const mtlText = textOf(mtlData)
            .split(/\r?\n/)
            .filter((l) => !/^\s*(map_|bump|disp|decal|refl)/i.test(l))
            .join('\n');
          const creator = new MTLLoader().parse(mtlText, '');
          creator.preload();
          loader.setMaterials(creator);
          hasMaterials = true;
        }
      }
      return { ext, hasMaterials, root: loader.parse(text) };
    }
    case '3mf':
      return { ext, hasMaterials: true, root: new ThreeMFLoader().parse(buf) };
    case 'amf':
      return { ext, hasMaterials: true, root: new AMFLoader().parse(buf) };
    case 'glb':
      return { ext, hasMaterials: true, root: (await new GLTFLoader().parseAsync(buf, '')).scene };
    case 'gltf': {
      const text = textOf(buf);
      const json = JSON.parse(text);
      const manager = new THREE.LoadingManager();
      const blobUrls = new Map();
      const external = [...(json.buffers || []), ...(json.images || [])]
        .map((x) => x.uri)
        .filter((u) => u && !u.startsWith('data:'));
      for (const uri of external) {
        const data = await readSibling(decodeURIComponent(uri));
        if (!data) continue;
        const mime = IMAGE_MIME[extOf(uri)] || 'application/octet-stream';
        blobUrls.set(uri, URL.createObjectURL(new Blob([data], { type: mime })));
      }
      manager.setURLModifier((url) => blobUrls.get(url) ?? blobUrls.get(decodeURIComponent(url)) ?? url);
      try {
        const gltf = await new GLTFLoader(manager).parseAsync(text, '');
        return { ext, hasMaterials: true, root: gltf.scene };
      } finally {
        blobUrls.forEach((u) => URL.revokeObjectURL(u));
      }
    }
    case 'fbx':
      return { ext, hasMaterials: true, root: new FBXLoader().parse(buf, '') };
    case 'dae':
      return { ext, hasMaterials: true, root: new ColladaLoader().parse(textOf(buf), '').scene };
    default:
      throw new Error(`Unsupported file type ".${ext}"`);
  }
}
