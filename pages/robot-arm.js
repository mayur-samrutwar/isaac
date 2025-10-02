import { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { OrbitControls } from 'three-stdlib';

export default function RobotArm() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const robotArmRef = useRef(null);
  const animationFrameRef = useRef(null);
  const controlsRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(3, 2, 3);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Additional fill lights
    const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight1.position.set(-5, 5, -5);
    scene.add(fillLight1);

    const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight2.position.set(0, -5, 5);
    scene.add(fillLight2);

    // Grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0xcccccc, 0xcccccc);
    scene.add(gridHelper);

    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 20;
    controlsRef.current = controls;

    // Load robot arm model
    const loader = new GLTFLoader();
    loader.load(
      '/robot_arm.glb',
      (gltf) => {
        const robotArm = gltf.scene;
        robotArm.scale.setScalar(1);
        robotArm.position.set(0, 0, 0);
        
        // Enable shadows
        robotArm.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(robotArm);
        robotArmRef.current = robotArm;
        setIsLoading(false);
        console.log('Robot arm loaded successfully');
      },
      (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total) * 100 + '%');
      },
      (err) => {
        console.error('Error loading robot arm:', err);
        setError('Failed to load robot arm model');
        setIsLoading(false);
      }
    );

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      // Update controls
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black relative">
      {/* Three.js canvas container */}
      <div ref={mountRef} className="w-full h-screen" />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-gray-400 border-t-white rounded-full animate-spin mb-4" />
            <p className="text-white text-lg font-medium">Loading Robot Arm...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-10">
          <div className="text-center">
            <p className="text-red-400 text-lg font-medium mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-white hover:bg-gray-200 text-black px-6 py-2 rounded font-mono text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Back to home */}
      <div className="absolute top-4 left-4 z-20">
        <a
          href="/"
          className="text-white hover:text-gray-300 font-mono text-sm transition-colors"
        >
          ← Back
        </a>
      </div>
    </div>
  );
}
