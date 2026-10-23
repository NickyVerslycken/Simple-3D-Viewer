import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const PART_COLORS = [
  '#4da3ff', '#ff7a59', '#5ad19a', '#f2c94c', '#c792ea', '#ff6b9a',
  '#4dd0e1', '#b0b7c3', '#9ccc65', '#ef5350', '#8d6e63', '#e8e8e8',
];

const DEFAULT_CREASE_ANGLE = THREE.MathUtils.degToRad(20); // edges sharper than this stay sharp in "smooth" shading
const EDGE_ANGLE = 30;
const MAX_SMOOTH_TRIS = 2_000_000;
const MAX_EDGE_TRIS = 800_000;

// Camera directions in world space (Y is up on screen). Front is the model's -Y side when Z-up.
const VIEWS = {
  iso: { dir: [1, 0.75, 1.1], up: [0, 1, 0] },
  front: { dir: [0, 0, 1], up: [0, 1, 0] },
  back: { dir: [0, 0, -1], up: [0, 1, 0] },
  right: { dir: [1, 0, 0], up: [0, 1, 0] },
  left: { dir: [-1, 0, 0], up: [0, 1, 0] },
  top: { dir: [0, 1, 0], up: [0, 0, -1] },
  bottom: { dir: [0, -1, 0], up: [0, 0, 1] },
};

const ZOOM_LEVELS = [10, 25, 33, 50, 67, 80, 90, 100, 110, 125, 150, 200, 300, 400, 500, 800, 1000, 1600, 2500, 4000];

const luminance =(c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

function niceStep(x) {
  const p = 10 ** Math.floor(Math.log10(x));
  const m = x / p;
  return p * (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10);
}

function labelSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.setScalar(0.55);
  return s;
}

export class Viewer {
  constructor(container, onNotice = () => {}) {
    this.container = container;
    this.onNotice = onNotice;
    this.s = {
      display: 'solid', // solid | edges | wire | xray | normals
      shading: 'smooth', // smooth | flat
      colorMode: 'single', // single | parts | original
      color: '#5aa2f0',
      background: '#1b1d22',
      shadows: true,
      grid: true,
      axes: true,
      zUp: true,
    };
    this.meshes = [];
    this.points = [];
    this.hasOriginal = false;
    this.creaseAngle = DEFAULT_CREASE_ANGLE;
    this.totalTris = 0;
    this.radius = 1;
    this.gridStep = 1;
    this.dirty = true;
    this.noticedEdges = false;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.autoClear = false;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    this.camera.position.set(0, 0, 100);
    this.scene.add(this.camera);

    this._initLights();
    this._initGizmo();

    // pivot rotates the model for Z-up; inner centers it on the origin.
    this.pivot = new THREE.Group();
    this.inner = new THREE.Group();
    this.pivot.add(this.inner);
    this.scene.add(this.pivot);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.ShadowMaterial({ opacity: 0.32 }),
    );
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.gridHelper = null;

    this.controls = new TrackballControls(this.camera, this.renderer.domElement);
    this.controls.rotateSpeed = 1.6;
    this.controls.zoomSpeed = 1.2;
    this.controls.panSpeed = 0.9;
    this.controls.staticMoving = false;
    this.controls.dynamicDampingFactor = 0.14;
    this.controls.keys = []; // no A/S/D modifier shortcuts
    this.controls.addEventListener('change', () => { this.dirty = true; });

    this._applyBackground();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this.resize();

    const loop = () => {
      requestAnimationFrame(loop);
      this.controls.update();
      if (this.dirty) {
        this.dirty = false;
        this.render();
      }
    };
    loop();
  }

  // ---------- setup ----------

  _initLights() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    // Key and fill lights ride along with the camera so the model stays lit while you rotate it.
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(-3, 4, 3);
    const fill = new THREE.DirectionalLight(0xbfd4ff, 0.55);
    fill.position.set(4, -1, 2);
    const target = new THREE.Object3D();
    target.position.set(0, 0, -10);
    key.target = target;
    fill.target = target;
    this.camera.add(key, fill, target);

    // A fixed light casts the shadows.
    this.shadowLight = new THREE.DirectionalLight(0xffffff, 0.9);
    this.shadowLight.castShadow = true;
    this.shadowLight.shadow.mapSize.set(2048, 2048);
    this.shadowLight.shadow.bias = -0.0003;
    this.scene.add(this.shadowLight);
  }

  _initGizmo() {
    this.gizmoScene = new THREE.Scene();
    this.gizmoCam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 20);
    this.gizmoAxes = new THREE.Group();
    this.gizmoScene.add(this.gizmoAxes);
    const axes = [
      ['X', new THREE.Vector3(1, 0, 0), '#ff5a5a'],
      ['Y', new THREE.Vector3(0, 1, 0), '#5fd35f'],
      ['Z', new THREE.Vector3(0, 0, 1), '#5a9bff'],
    ];
    const up = new THREE.Vector3(0, 1, 0);
    for (const [label, dir, color] of axes) {
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1, 10),
        new THREE.MeshBasicMaterial({ color }),
      );
      rod.quaternion.setFromUnitVectors(up, dir);
      rod.position.copy(dir).multiplyScalar(0.5);
      const sprite = labelSprite(label, color);
      sprite.position.copy(dir).multiplyScalar(1.3);
      this.gizmoAxes.add(rod, sprite);
    }
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.controls.handleResize();
    this.dirty = true;
  }

  // ---------- rendering ----------

  render(withGizmo = true) {
    const r = this.renderer;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this._notifyZoom();
    r.setScissorTest(false);
    r.setViewport(0, 0, w, h);
    r.setClearColor(this.bgColor);
    r.clear();
    r.render(this.scene, this.camera);

    if (withGizmo && this.s.axes && this.hasModel) {
      const size = 96;
      this.gizmoCam.position.copy(this.camera.position).sub(this.controls.target).setLength(8);
      this.gizmoCam.up.copy(this.camera.up);
      this.gizmoCam.lookAt(0, 0, 0);
      r.setViewport(12, 12, size, size);
      r.setScissor(12, 12, size, size);
      r.setScissorTest(true);
      r.clearDepth();
      r.render(this.gizmoScene, this.gizmoCam);
      r.setScissorTest(false);
    }
  }

  /** Returns the current view as a PNG data URL (without the axes gizmo). */
  screenshot() {
    this.render(false);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.dirty = true;
    return url;
  }

  // ---------- settings ----------

  get hasModel() {
    return this.meshes.length > 0 || this.points.length > 0;
  }

  get effectiveColorMode() {
    return this.s.colorMode === 'original' && !this.hasOriginal ? 'single' : this.s.colorMode;
  }

  update(changes) {
    Object.assign(this.s, changes);
    if ('background' in changes) {
      this._applyBackground();
      this._buildGrid();
    }
    if ('zUp' in changes) this.layout();
    if (['display', 'shading', 'colorMode', 'color', 'shadows', 'background'].some((k) => k in changes)) {
      this.applyAppearance();
    }
    this._updateVisibility();
    this.dirty = true;
  }

  _applyBackground() {
    this.bgColor = new THREE.Color(this.s.background);
  }

  _updateVisibility() {
    if (this.gridHelper) this.gridHelper.visible = this.s.grid;
    this.ground.visible = this.s.shadows && this.hasModel;
    this.shadowLight.castShadow = this.s.shadows;
  }

  // ---------- model ----------

  _clearModel() {
    this.inner.traverse((o) => {
      if (o.userData.smooth) o.userData.smooth.dispose();
      if (o.userData.generated) this._disposeMaterial(o.userData.generated);
      if (o.userData.edges) o.userData.edges.geometry.dispose();
      if (o.geometry) o.geometry.dispose();
    });
    this.inner.clear();
    this.meshes = [];
    this.points = [];
  }

  _disposeMaterial(m) {
    (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
  }

  /**
   * Shows a parsed model. Returns {size, triangles, vertices, parts}.
   * opts: {ext, hasMaterials, zUp}
   */
  setModel(root, { ext = '', hasMaterials = false, zUp = true } = {}) {
    this._clearModel();
    this.inner.add(root);
    this.ext = ext;

    let tris = 0;
    let verts = 0;
    root.traverse((o) => {
      if (o.isMesh && o.geometry?.attributes.position) {
        const g = o.geometry;
        o.userData.hadNormals = !!g.attributes.normal;
        if (!g.attributes.normal) g.computeVertexNormals();
        o.userData.base = g;
        o.userData.orig = o.material;
        o.userData.tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
        tris += o.userData.tris;
        verts += g.attributes.position.count;
        this.meshes.push(o);
      } else if (o.isPoints && o.geometry?.attributes.position) {
        verts += o.geometry.attributes.position.count;
        this.points.push(o);
      }
    });
    if (!this.hasModel) {
      this.inner.clear();
      throw new Error('No mesh data found in this file.');
    }
    this.totalTris = tris;
    this.noticedEdges = false;
    this.hasOriginal = hasMaterials || this.meshes.some((m) => m.geometry.attributes.color);

    this.pivot.rotation.set(0, 0, 0);
    this.inner.position.set(0, 0, 0);
    this.pivot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    this.inner.position.copy(box.getCenter(new THREE.Vector3())).negate();

    this.s.zUp = zUp;
    this.applyAppearance();
    this.layout();
    this.setView('iso');
    return { size, triangles: Math.round(tris), vertices: verts, parts: this.meshes.length || this.points.length };
  }

  /** Geometry used for the current shading mode. */
  _geometryFor(mesh) {
    const base = mesh.userData.base;
    const fileNormals = mesh.userData.hadNormals && this.ext !== 'stl';
    if (this.s.shading === 'flat' || fileNormals || mesh.userData.tris > MAX_SMOOTH_TRIS) return base;
    if (!mesh.userData.smooth) mesh.userData.smooth = toCreasedNormals(base.clone(), this.creaseAngle);
    return mesh.userData.smooth;
  }

  applyAppearance() {
    const { display, shading, shadows, color } = this.s;
    const mode = this.effectiveColorMode;
    const flat = shading === 'flat';
    const wantEdges = display === 'edges' || display === 'xray';

    this.meshes.forEach((mesh, i) => {
      mesh.geometry = this._geometryFor(mesh);
      if (mesh.userData.generated) this._disposeMaterial(mesh.userData.generated);

      const base = new THREE.Color(mode === 'parts' ? PART_COLORS[i % PART_COLORS.length] : color);
      let mat;
      if (display === 'normals') {
        mat = new THREE.MeshNormalMaterial({ flatShading: flat });
      } else if (mode === 'original') {
        const o = mesh.userData.orig;
        mat = Array.isArray(o) ? o.map((m) => m.clone()) : o.clone();
      } else {
        mat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.55, metalness: 0.08, flatShading: flat });
      }
      for (const m of Array.isArray(mat) ? mat : [mat]) {
        m.side = THREE.DoubleSide;
        m.flatShading = flat;
        m.wireframe = display === 'wire';
        if (display === 'xray') {
          m.transparent = true;
          m.opacity = 0.35;
          m.depthWrite = false;
        }
        if (wantEdges) {
          m.polygonOffset = true;
          m.polygonOffsetFactor = 1;
          m.polygonOffsetUnits = 1;
        }
        m.needsUpdate = true;
      }
      mesh.material = mat;
      mesh.userData.generated = mat;
      mesh.castShadow = mesh.receiveShadow = shadows && display !== 'wire' && display !== 'xray';

      this._updateEdges(mesh, mode === 'original' ? new THREE.Color(0x888888) : base, wantEdges, display === 'xray');
    });

    for (const p of this.points) {
      if (p.userData.generated) p.userData.generated.dispose();
      const colored = !!p.geometry.attributes.color;
      p.material = new THREE.PointsMaterial({
        size: Math.max(this.radius * 0.006, 1e-6),
        vertexColors: colored,
        color: colored ? 0xffffff : new THREE.Color(color),
      });
      p.userData.generated = p.material;
    }
    this.dirty = true;
  }

  _updateEdges(mesh, base, want, xray) {
    let edges = mesh.userData.edges;
    if (want && !edges) {
      if (this.totalTris > MAX_EDGE_TRIS) {
        if (!this.noticedEdges) this.onNotice('Model is too dense for the edge overlay.');
        this.noticedEdges = true;
        return;
      }
      edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.userData.base, EDGE_ANGLE), new THREE.LineBasicMaterial());
      edges.raycast = () => {};
      mesh.add(edges);
      mesh.userData.edges = edges;
    }
    if (!edges) return;
    edges.visible = want;
    edges.material.color.copy(base);
    if (xray) edges.material.color.lerp(new THREE.Color(0xffffff), 0.35);
    else edges.material.color.multiplyScalar(0.3);
  }

  /** Recomputes everything that depends on the model's size/orientation: ground, grid, shadows, camera range. */
  layout() {
    if (!this.hasModel) return;
    this.pivot.rotation.set(this.s.zUp ? -Math.PI / 2 : 0, 0, 0);
    this.gizmoAxes.rotation.copy(this.pivot.rotation);
    this.pivot.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(this.pivot);
    const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1e-6);
    this.radius = r;
    this.groundY = box.min.y;

    this.ground.scale.setScalar(r * 12);
    this.ground.position.y = this.groundY - r * 0.0005;

    const light = this.shadowLight;
    light.position.set(0.45, 1, 0.55).normalize().multiplyScalar(r * 4);
    const cam = light.shadow.camera;
    cam.left = cam.bottom = -r * 1.35;
    cam.right = cam.top = r * 1.35;
    cam.near = r * 0.5;
    cam.far = r * 8;
    cam.updateProjectionMatrix();
    light.shadow.normalBias = r * 0.003;

    this.camera.near = r * 0.01;
    this.camera.far = r * 200;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = r * 0.03;
    this.controls.maxDistance = r * 40;

    for (const p of this.points) {
      if (p.material) p.material.size = r * 0.006;
    }
    this._buildGrid();
    this._updateVisibility();
    this.dirty = true;
  }

  _buildGrid() {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
      this.gridHelper.material.dispose();
      this.gridHelper = null;
    }
    if (!this.hasModel) return;
    const step = niceStep(this.radius / 4);
    const cells = 2 * Math.ceil((this.radius * 2.5) / step);
    const fg = new THREE.Color(luminance(this.bgColor) > 0.5 ? 0x000000 : 0xffffff);
    const center = this.bgColor.clone().lerp(fg, 0.2);
    const line = this.bgColor.clone().lerp(fg, 0.09);
    this.gridHelper = new THREE.GridHelper(cells * step, cells, center, line);
    this.gridHelper.position.y = this.groundY;
    this.scene.add(this.gridHelper);
    this.gridStep = step;
  }

  // ---------- camera ----------

  get fitDistance() {
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    return (this.radius / Math.sin(Math.min(vfov, hfov) / 2)) * 1.08;
  }

  /** Zoom as a percentage: 100% is the model fitted to the window. */
  get zoomPercent() {
    const d = this.camera.position.distanceTo(this.controls.target);
    return d > 0 ? (this.fitDistance / d) * 100 : 100;
  }

  setZoom(percent) {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const d = THREE.MathUtils.clamp(this.fitDistance * (100 / percent), this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).addScaledVector(dir, d);
    this.controls.update();
    this.dirty = true;
  }

  /** Steps to the next preset zoom level above (direction 1) or below (-1) the current one. */
  zoomStep(direction) {
    const p = this.zoomPercent;
    const next = direction > 0
      ? ZOOM_LEVELS.find((l) => l > p * 1.005)
      : [...ZOOM_LEVELS].reverse().find((l) => l < p * 0.995);
    if (next) this.setZoom(next);
  }

  _notifyZoom() {
    const p = Math.round(this.zoomPercent);
    if (p !== this._lastZoom) {
      this._lastZoom = p;
      this.onZoom?.(p);
    }
  }

  /** Looks at the model from a named direction ("iso", "front", ...), fitted to the window. */
  setView(name = 'iso') {
    const v = VIEWS[name] || VIEWS.iso;
    this.camera.up.set(...v.up);
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(...v.dir).normalize().multiplyScalar(this.fitDistance);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
    this.dirty = true;
  }

  /** Re-fits the model while keeping the current viewing direction. */
  fit() {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.set(0, 0, 0);
    this.camera.position.copy(dir.multiplyScalar(this.fitDistance));
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
    this.dirty = true;
  }
}
