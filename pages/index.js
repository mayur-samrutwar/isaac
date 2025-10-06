import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader, OrbitControls } from 'three-stdlib';

export default function Home() {
  const miraMountRef = useRef(null);
  const miraRendererRef = useRef(null);
  const miraSceneRef = useRef(null);
  const miraCameraRef = useRef(null);
  const miraAnimRef = useRef(null);
  const miraControlsRef = useRef(null);
  const miraModelRef = useRef(null);
  const hoverTargetRef = useRef({ x: 0, y: 0 });
  const isHoveringRef = useRef(false);

  const handleScrollDown = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!miraMountRef.current) return;

    const width = miraMountRef.current.clientWidth;
    const height = miraMountRef.current.clientHeight;

    const scene = new THREE.Scene();
    miraSceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.1, 2.2);
    miraCameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    miraRendererRef.current = renderer;
    miraMountRef.current.appendChild(renderer.domElement);

    // Lights (monochrome-friendly)
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(3, 4, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    // Controls (mouse rotate)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.enableZoom = false; // disable wheel/pinch zoom so page scroll doesn't zoom model
    controls.minDistance = 0.5;
    controls.maxDistance = 10;
    controls.target.set(0, 0, 0);
    miraControlsRef.current = controls;

    const loader = new GLTFLoader();
    loader.load(
      '/meet_mira.glb',
      (gltf) => {
        const model = gltf.scene;
        miraModelRef.current = model;
        // Center model at origin
        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.sub(center);

        // Robust framing: fit height and width with padding
        const size = new THREE.Vector3();
        box.getSize(size);
        const fov = THREE.MathUtils.degToRad(camera.fov);
        const aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight || 1;
        const distY = (size.y / 2) / Math.tan(fov / 2);
        const hFov = 2 * Math.atan(Math.tan(fov / 2) * aspect);
        const distX = (size.x / 2) / Math.tan(hFov / 2);
        const padding = 1.2; // ensure no cropping top/bottom
        const distance = Math.max(distX, distY) * padding;
        camera.near = Math.max(0.01, distance / 50);
        camera.far = distance * 50;
        camera.position.set(0, size.y * 0.1, distance);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        scene.add(model);

        const animate = () => {
          miraAnimRef.current = requestAnimationFrame(animate);
          miraControlsRef.current?.update();
          // Hover reaction: ease model rotation toward hover target
          if (miraModelRef.current) {
            const m = miraModelRef.current;
            const targetY = hoverTargetRef.current.y; // yaw
            const targetX = hoverTargetRef.current.x; // pitch
            m.rotation.y = THREE.MathUtils.lerp(m.rotation.y, targetY, 0.08);
            m.rotation.x = THREE.MathUtils.lerp(m.rotation.x, targetX, 0.08);
          }
          renderer.render(scene, camera);
        };
        animate();
      },
      undefined,
      (err) => {
        console.error('Failed to load meet_mira.glb', err);
      }
    );

    const onResize = () => {
      if (!miraMountRef.current || !miraRendererRef.current || !miraCameraRef.current) return;
      const w = miraMountRef.current.clientWidth;
      const h = miraMountRef.current.clientHeight;
      miraRendererRef.current.setSize(w, h);
      miraCameraRef.current.aspect = w / h;
      miraCameraRef.current.updateProjectionMatrix();
      // Reframe on resize
      if (miraModelRef.current) {
        const model = miraModelRef.current;
        const bbox = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const camera = miraCameraRef.current;
        const renderer = miraRendererRef.current;
        const fov = THREE.MathUtils.degToRad(camera.fov);
        const aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight || 1;
        const distY = (size.y / 2) / Math.tan(fov / 2);
        const hFov = 2 * Math.atan(Math.tan(fov / 2) * aspect);
        const distX = (size.x / 2) / Math.tan(hFov / 2);
        const padding = 1.2;
        const distance = Math.max(distX, distY) * padding;
        camera.near = Math.max(0.01, distance / 50);
        camera.far = distance * 50;
        camera.position.set(0, size.y * 0.1, distance);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      }
    };
    window.addEventListener('resize', onResize);

    // Pointer hover interactions
    const onPointerMove = (e) => {
      if (!miraMountRef.current) return;
      const rect = miraMountRef.current.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;  // 0..1
      const ny = (e.clientY - rect.top) / rect.height; // 0..1
      // Map to gentle rotations
      const maxYaw = 0.35;   // left/right
      const maxPitch = 0.18; // up/down
      hoverTargetRef.current = {
        y: (nx - 0.5) * 2 * maxYaw,
        x: (0.5 - ny) * 2 * maxPitch
      };
    };
    const onPointerEnter = () => { isHoveringRef.current = true; };
    const onPointerLeave = () => {
      isHoveringRef.current = false;
      hoverTargetRef.current = { x: 0, y: 0 };
    };
    // Attach listeners to the renderer element for precise coords
    const mountEl = miraMountRef.current;
    mountEl.addEventListener('pointermove', onPointerMove);
    mountEl.addEventListener('pointerenter', onPointerEnter);
    mountEl.addEventListener('pointerleave', onPointerLeave);

    return () => {
      window.removeEventListener('resize', onResize);
      if (miraAnimRef.current) cancelAnimationFrame(miraAnimRef.current);
      if (miraRendererRef.current) {
        miraRendererRef.current.dispose();
        if (miraRendererRef.current.domElement && miraMountRef.current) {
          try { miraMountRef.current.removeChild(miraRendererRef.current.domElement); } catch {}
        }
      }
      if (mountEl) {
        try {
          mountEl.removeEventListener('pointermove', onPointerMove);
          mountEl.removeEventListener('pointerenter', onPointerEnter);
          mountEl.removeEventListener('pointerleave', onPointerLeave);
        } catch {}
      }
      miraRendererRef.current = null;
      miraSceneRef.current = null;
      miraCameraRef.current = null;
      miraControlsRef.current = null;
      miraModelRef.current = null;
    };
  }, []);
  return (
    <div className="min-h-screen bg-white text-black flex flex-col items-center justify-center">
      <div className="relative w-[340px] h-[340px] md:w-[640px] md:h-[640px]">
        {/* Background texts behind robot */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center select-none">
          <div className="text-black/5 font-semibold tracking-tight text-8xl md:text-[14rem] leading-none">ISAAC</div>
        </div>
        <div className="pointer-events-none absolute inset-0 select-none">
          <div className="absolute left-4 top-4 text-black/10 font-mono text-xs">ISAAC</div>
          <div className="absolute right-4 bottom-4 text-black/10 font-mono text-xs">ROBOTS×AI</div>
        </div>
        {/* 3D mount */}
        <div ref={miraMountRef} className="relative w-full h-full" />
      </div>
      {/* Headline and subtext */}
      <div className="mt-8 text-center px-6">
        <h1 className="text-2xl md:text-4xl font-semibold tracking-tight">Global motion data for humanoid robots</h1>
        <p className="mt-3 text-sm md:text-base text-black/60 font-normal">
          Perform precise actions. Your movement trains high‑fidelity control models at scale.
        </p>
      </div>
      {/* Scroll down button */}
      <button
        onClick={handleScrollDown}
        aria-label="Scroll down"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-black/20 bg-white px-4 py-2 text-xs font-mono hover:bg-black hover:text-white transition-colors"
      >
        ↓
      </button>
    </div>
  );
}
