import { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';

export default function ProceduralRobotArm() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const robotArmRef = useRef(null);
  const animationFrameRef = useRef(null);
  const controlsRef = useRef(null);
  
  // Joint angles (in radians)
  const [jointAngles, setJointAngles] = useState({
    base: 0,      // Base rotation
    shoulder: 0,  // Shoulder joint
    elbow: 0,     // Elbow joint
    wrist: 0,     // Wrist joint
    gripper: 0    // Gripper rotation
  });

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Grid
    const gridHelper = new THREE.GridHelper(20, 20, 0xcccccc, 0xcccccc);
    scene.add(gridHelper);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Create robot arm
    const robotArm = createRobotArm();
    scene.add(robotArm);
    robotArmRef.current = robotArm;

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update robot arm when joint angles change
  useEffect(() => {
    if (robotArmRef.current) {
      updateRobotArmPose(robotArmRef.current, jointAngles);
    }
  }, [jointAngles]);

  const createRobotArm = () => {
    const robotGroup = new THREE.Group();

    // Material
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x666666,
      transparent: true,
      opacity: 0.9
    });

    // Base (rotating platform)
    const baseGeometry = new THREE.CylinderGeometry(1, 1, 0.5, 16);
    const base = new THREE.Mesh(baseGeometry, material);
    base.position.y = 0.25;
    base.castShadow = true;
    base.receiveShadow = true;
    robotGroup.add(base);

    // Base joint group
    const baseJoint = new THREE.Group();
    baseJoint.position.y = 0.5;
    robotGroup.add(baseJoint);

    // Shoulder segment
    const shoulderGeometry = new THREE.BoxGeometry(0.3, 2, 0.3);
    const shoulder = new THREE.Mesh(shoulderGeometry, material);
    shoulder.position.y = 1;
    shoulder.castShadow = true;
    shoulder.receiveShadow = true;
    baseJoint.add(shoulder);

    // Shoulder joint group
    const shoulderJoint = new THREE.Group();
    shoulderJoint.position.y = 2;
    baseJoint.add(shoulderJoint);

    // Upper arm
    const upperArmGeometry = new THREE.BoxGeometry(0.25, 1.5, 0.25);
    const upperArm = new THREE.Mesh(upperArmGeometry, material);
    upperArm.position.y = 0.75;
    upperArm.castShadow = true;
    upperArm.receiveShadow = true;
    shoulderJoint.add(upperArm);

    // Elbow joint group
    const elbowJoint = new THREE.Group();
    elbowJoint.position.y = 1.5;
    shoulderJoint.add(elbowJoint);

    // Forearm
    const forearmGeometry = new THREE.BoxGeometry(0.2, 1.2, 0.2);
    const forearm = new THREE.Mesh(forearmGeometry, material);
    forearm.position.y = 0.6;
    forearm.castShadow = true;
    forearm.receiveShadow = true;
    elbowJoint.add(forearm);

    // Wrist joint group
    const wristJoint = new THREE.Group();
    wristJoint.position.y = 1.2;
    elbowJoint.add(wristJoint);

    // Gripper base
    const gripperBaseGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
    const gripperBase = new THREE.Mesh(gripperBaseGeometry, material);
    gripperBase.position.y = 0.15;
    gripperBase.castShadow = true;
    gripperBase.receiveShadow = true;
    wristJoint.add(gripperBase);

    // Gripper fingers
    const fingerGeometry = new THREE.BoxGeometry(0.05, 0.3, 0.05);
    
    const leftFinger = new THREE.Mesh(fingerGeometry, material);
    leftFinger.position.set(-0.1, 0.3, 0);
    leftFinger.castShadow = true;
    leftFinger.receiveShadow = true;
    wristJoint.add(leftFinger);

    const rightFinger = new THREE.Mesh(fingerGeometry, material);
    rightFinger.position.set(0.1, 0.3, 0);
    rightFinger.castShadow = true;
    rightFinger.receiveShadow = true;
    wristJoint.add(rightFinger);

    // Store references for animation
    robotGroup.userData = {
      baseJoint,
      shoulderJoint,
      elbowJoint,
      wristJoint,
      leftFinger,
      rightFinger
    };

    return robotGroup;
  };

  const updateRobotArmPose = (robotArm, angles) => {
    const { baseJoint, shoulderJoint, elbowJoint, wristJoint, leftFinger, rightFinger } = robotArm.userData;
    
    // Apply rotations
    baseJoint.rotation.y = angles.base;
    shoulderJoint.rotation.z = angles.shoulder;
    elbowJoint.rotation.z = angles.elbow;
    wristJoint.rotation.z = angles.wrist;
    
    // Gripper opening/closing
    const gripperOpen = Math.sin(angles.gripper) * 0.1;
    leftFinger.position.x = -0.1 - gripperOpen;
    rightFinger.position.x = 0.1 + gripperOpen;
  };

  const updateJoint = (jointName, value) => {
    setJointAngles(prev => ({
      ...prev,
      [jointName]: value
    }));
  };

  return (
    <div className="min-h-screen bg-white relative">
      {/* Three.js canvas */}
      <div ref={mountRef} className="w-full h-screen" />
      
      {/* Control Panel */}
      <div className="absolute top-4 left-4 bg-black/80 text-white p-4 rounded-lg font-mono text-sm">
        <h3 className="text-lg font-bold mb-4 text-yellow-400">Robot Arm Controls</h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1">Base Rotation</label>
            <input
              type="range"
              min="-3.14"
              max="3.14"
              step="0.1"
              value={jointAngles.base}
              onChange={(e) => updateJoint('base', parseFloat(e.target.value))}
              className="w-full"
            />
            <span className="text-xs text-gray-300">{jointAngles.base.toFixed(2)} rad</span>
          </div>
          
          <div>
            <label className="block text-xs mb-1">Shoulder</label>
            <input
              type="range"
              min="-1.57"
              max="1.57"
              step="0.1"
              value={jointAngles.shoulder}
              onChange={(e) => updateJoint('shoulder', parseFloat(e.target.value))}
              className="w-full"
            />
            <span className="text-xs text-gray-300">{jointAngles.shoulder.toFixed(2)} rad</span>
          </div>
          
          <div>
            <label className="block text-xs mb-1">Elbow</label>
            <input
              type="range"
              min="-1.57"
              max="1.57"
              step="0.1"
              value={jointAngles.elbow}
              onChange={(e) => updateJoint('elbow', parseFloat(e.target.value))}
              className="w-full"
            />
            <span className="text-xs text-gray-300">{jointAngles.elbow.toFixed(2)} rad</span>
          </div>
          
          <div>
            <label className="block text-xs mb-1">Wrist</label>
            <input
              type="range"
              min="-1.57"
              max="1.57"
              step="0.1"
              value={jointAngles.wrist}
              onChange={(e) => updateJoint('wrist', parseFloat(e.target.value))}
              className="w-full"
            />
            <span className="text-xs text-gray-300">{jointAngles.wrist.toFixed(2)} rad</span>
          </div>
          
          <div>
            <label className="block text-xs mb-1">Gripper</label>
            <input
              type="range"
              min="0"
              max="6.28"
              step="0.1"
              value={jointAngles.gripper}
              onChange={(e) => updateJoint('gripper', parseFloat(e.target.value))}
              className="w-full"
            />
            <span className="text-xs text-gray-300">{jointAngles.gripper.toFixed(2)} rad</span>
          </div>
        </div>
        
        <button
          onClick={() => setJointAngles({ base: 0, shoulder: 0, elbow: 0, wrist: 0, gripper: 0 })}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors"
        >
          Reset Pose
        </button>
      </div>
      
      {/* Back button */}
      <div className="absolute top-4 right-4">
        <a
          href="/"
          className="text-black hover:text-gray-600 font-mono text-sm transition-colors"
        >
          ← Back
        </a>
      </div>
    </div>
  );
}
