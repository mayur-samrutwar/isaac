import { useState, useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

// Note: We'll lazy-load MediaPipe Tasks Hand Landmarker at runtime to avoid SSR issues

export default function ThreeD() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [detector, setDetector] = useState(null);
  const animationFrameRef = useRef(null);
  const smoothedKeypointsRef = useRef({});
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const renderStateRef = useRef({ scale: 1, drawX: 0, drawY: 0, videoW: 0, videoH: 0 });
  const resizeHandlerRef = useRef(null);
  
  // Body tracking state
  const [trackedBodyParts, setTrackedBodyParts] = useState({});
  const [collisionEvents, setCollisionEvents] = useState([]);
  const [bodyPartStats, setBodyPartStats] = useState({});
  const handLandmarkerRef = useRef(null);
  const visionFilesetRef = useRef(null);
  const lastVideoTsRef = useRef(0);

  // Body tracking utilities
  const getBodyPartPosition = (keypoints, bodyPartName) => {
    const keypoint = keypoints.find(kp => kp.name === bodyPartName);
    return keypoint && keypoint.score > 0.3 ? { x: keypoint.x, y: keypoint.y, score: keypoint.score } : null;
  };

  const checkCollision = (bodyPartPos, targetPos, radius) => {
    if (!bodyPartPos || !targetPos) return false;
    const dx = bodyPartPos.x - targetPos.x;
    const dy = bodyPartPos.y - targetPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < radius;
  };

  const updateBodyPartTracking = (keypoints) => {
    const newTrackedParts = {};
    const smoothingFactor = 0.7; // higher = smoother but laggier
    const collisionAreas = {
      left_wrist: 40, right_wrist: 40,
      left_ankle: 35, right_ankle: 35,
      nose: 30,
      left_elbow: 25, right_elbow: 25,
      left_knee: 25, right_knee: 25,
      left_shoulder: 20, right_shoulder: 20,
      left_hip: 20, right_hip: 20
    };

    Object.keys(collisionAreas).forEach(bodyPart => {
      const raw = getBodyPartPosition(keypoints, bodyPart);
      if (raw) {
        const prev = smoothedKeypointsRef.current[bodyPart] || raw;
        const smoothed = {
          x: prev.x * smoothingFactor + raw.x * (1 - smoothingFactor),
          y: prev.y * smoothingFactor + raw.y * (1 - smoothingFactor),
          score: raw.score
        };
        smoothedKeypointsRef.current[bodyPart] = smoothed;
        newTrackedParts[bodyPart] = {
          ...smoothed,
          radius: collisionAreas[bodyPart],
          lastUpdate: Date.now()
        };
      }
    });

    setTrackedBodyParts(newTrackedParts);
    return newTrackedParts;
  };

  const detectBodyCollisions = (trackedParts, targets) => {
    const newCollisions = [];
    
    targets.forEach(target => {
      Object.entries(trackedParts).forEach(([bodyPart, bodyPartData]) => {
        if (checkCollision(bodyPartData, target.position, bodyPartData.radius + target.radius)) {
          newCollisions.push({
            bodyPart,
            target: target.id,
            timestamp: Date.now(),
            position: bodyPartData
          });
        }
      });
    });

    if (newCollisions.length > 0) {
      setCollisionEvents(prev => [...prev, ...newCollisions].slice(-50)); // Keep last 50 events
    }
  };

  // Initialize TensorFlow.js and pose detection
  const initializePoseDetection = async () => {
    try {
      console.log('Initializing TensorFlow.js...');
      await tf.ready();
      await tf.setBackend('webgl');
      
      console.log('Loading MoveNet model...');
      const poseDetector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER }
      );
      
      setDetector(poseDetector);
      console.log('Pose detection initialized successfully');

      // Lazy-load MediaPipe Hand Landmarker
      if (typeof window !== 'undefined' && !handLandmarkerRef.current) {
        const vision = await import('@mediapipe/tasks-vision');
        const fileset = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        visionFilesetRef.current = fileset;
        handLandmarkerRef.current = await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
          },
          numHands: 2,
          runningMode: 'VIDEO'
        });
        console.log('Hand Landmarker initialized');
      }
    } catch (err) {
      console.error('Error initializing pose detection:', err);
      setError('Failed to initialize pose detection');
    }
  };

  // Enhanced body tracking with collision detection areas
  const drawPose = (poses, ctx) => {
    if (!poses || poses.length === 0) return;

    const pose = poses[0];
    const keypoints = pose.keypoints;

    // Define collision detection areas for different body parts
    const collisionAreas = {
      // Hands - primary interaction points
      left_wrist: { radius: 40, color: 'rgba(255, 255, 0, 0.3)', strokeColor: 'rgba(255, 255, 0, 0.8)' },
      right_wrist: { radius: 40, color: 'rgba(255, 255, 0, 0.3)', strokeColor: 'rgba(255, 255, 0, 0.8)' },
      
      // Feet - secondary interaction points
      left_ankle: { radius: 35, color: 'rgba(0, 255, 255, 0.3)', strokeColor: 'rgba(0, 255, 255, 0.8)' },
      right_ankle: { radius: 35, color: 'rgba(0, 255, 255, 0.3)', strokeColor: 'rgba(0, 255, 255, 0.8)' },
      
      // Head - special interaction point
      nose: { radius: 30, color: 'rgba(255, 0, 255, 0.3)', strokeColor: 'rgba(255, 0, 255, 0.8)' },
      
      // Elbows and knees - tertiary interaction points
      left_elbow: { radius: 25, color: 'rgba(255, 165, 0, 0.3)', strokeColor: 'rgba(255, 165, 0, 0.8)' },
      right_elbow: { radius: 25, color: 'rgba(255, 165, 0, 0.3)', strokeColor: 'rgba(255, 165, 0, 0.8)' },
      left_knee: { radius: 25, color: 'rgba(255, 165, 0, 0.3)', strokeColor: 'rgba(255, 165, 0, 0.8)' },
      right_knee: { radius: 25, color: 'rgba(255, 165, 0, 0.3)', strokeColor: 'rgba(255, 165, 0, 0.8)' },
      
      // Shoulders and hips - body core points
      left_shoulder: { radius: 20, color: 'rgba(128, 128, 128, 0.3)', strokeColor: 'rgba(128, 128, 128, 0.8)' },
      right_shoulder: { radius: 20, color: 'rgba(128, 128, 128, 0.3)', strokeColor: 'rgba(128, 128, 128, 0.8)' },
      left_hip: { radius: 20, color: 'rgba(128, 128, 128, 0.3)', strokeColor: 'rgba(128, 128, 128, 0.8)' },
      right_hip: { radius: 20, color: 'rgba(128, 128, 128, 0.3)', strokeColor: 'rgba(128, 128, 128, 0.8)' }
    };

    // Draw collision detection areas for high-confidence keypoints
    keypoints.forEach(keypoint => {
      if (keypoint.score > 0.3 && collisionAreas[keypoint.name]) {
        const area = collisionAreas[keypoint.name];
        
        // Draw filled collision area
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, area.radius, 0, 2 * Math.PI);
        ctx.fillStyle = area.color;
        ctx.fill();
        
        // Draw collision area border
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, area.radius, 0, 2 * Math.PI);
        ctx.strokeStyle = area.strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw keypoint center
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();
        
        // Draw keypoint border
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 6, 0, 2 * Math.PI);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (keypoint.score > 0.3) {
        // Draw regular keypoints for other body parts
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();
      }
    });

    // Enhanced connections with different line weights and colors
    const connections = [
      // Head connections - thicker lines
      { parts: ['left_eye', 'right_eye'], width: 3, color: 'rgba(255, 255, 255, 0.9)' },
      { parts: ['left_eye', 'left_ear'], width: 2, color: 'rgba(255, 255, 255, 0.7)' },
      { parts: ['right_eye', 'right_ear'], width: 2, color: 'rgba(255, 255, 255, 0.7)' },
      { parts: ['left_ear', 'right_ear'], width: 2, color: 'rgba(255, 255, 255, 0.7)' },
      { parts: ['nose', 'left_eye'], width: 2, color: 'rgba(255, 255, 255, 0.7)' },
      { parts: ['nose', 'right_eye'], width: 2, color: 'rgba(255, 255, 255, 0.7)' },
      
      // Torso connections - medium thickness
      { parts: ['left_shoulder', 'right_shoulder'], width: 4, color: 'rgba(255, 255, 255, 0.8)' },
      { parts: ['left_shoulder', 'left_hip'], width: 3, color: 'rgba(255, 255, 255, 0.7)' },
      { parts: ['right_shoulder', 'right_hip'], width: 3, color: 'rgba(255, 255, 255, 0.7)' },
      { parts: ['left_hip', 'right_hip'], width: 3, color: 'rgba(255, 255, 255, 0.7)' },
      
      // Arm connections - medium thickness
      { parts: ['left_shoulder', 'left_elbow'], width: 3, color: 'rgba(255, 255, 255, 0.8)' },
      { parts: ['left_elbow', 'left_wrist'], width: 3, color: 'rgba(255, 255, 255, 0.8)' },
      { parts: ['right_shoulder', 'right_elbow'], width: 3, color: 'rgba(255, 255, 255, 0.8)' },
      { parts: ['right_elbow', 'right_wrist'], width: 3, color: 'rgba(255, 255, 255, 0.8)' },
      
      // Leg connections - medium thickness
      { parts: ['left_hip', 'left_knee'], width: 3, color: 'rgba(255, 255, 255, 0.8)' },
      { parts: ['left_knee', 'left_ankle'], width: 3, color: 'rgba(255, 255, 255, 0.8)' },
      { parts: ['right_hip', 'right_knee'], width: 3, color: 'rgba(255, 255, 255, 0.8)' },
      { parts: ['right_knee', 'right_ankle'], width: 3, color: 'rgba(255, 255, 255, 0.8)' }
    ];

    connections.forEach(({ parts: [start, end], width, color }) => {
      const startPoint = keypoints.find(kp => kp.name === start);
      const endPoint = keypoints.find(kp => kp.name === end);
      
      if (startPoint && endPoint && startPoint.score > 0.3 && endPoint.score > 0.3) {
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
      }
    });
  };

  // Enhanced pose detection loop with body tracking and performance optimization
  const detectPose = async () => {
    if (!detector || !videoRef.current || !canvasRef.current) return;

    try {
      const poses = await detector.estimatePoses(videoRef.current);
      const ctx = canvasRef.current.getContext('2d');
      const { scale, drawX, drawY, videoW, videoH } = renderStateRef.current;
      
      // Clear canvas (do not draw the camera frame)
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      if (poses && poses.length > 0) {
        const mappedKeypoints = poses[0].keypoints.map(kp => ({ ...kp, x: kp.x * scale + drawX, y: kp.y * scale + drawY }));
        
        // Update body part tracking
        const trackedParts = updateBodyPartTracking(mappedKeypoints);
        
        // Example: Check for collisions with virtual targets
        // You can replace this with your game objects
        const virtualTargets = [
          // { id: 'target1', position: { x: 200, y: 200 }, radius: 30 },
          // { id: 'target2', position: { x: 400, y: 300 }, radius: 25 },
          // { id: 'target3', position: { x: 600, y: 150 }, radius: 35 }
        ];
        
        detectBodyCollisions(trackedParts, virtualTargets);
        
        // Draw virtual targets with optimized rendering
        ctx.save();
        virtualTargets.forEach(target => {
          ctx.beginPath();
          ctx.arc(target.position.x, target.position.y, target.radius, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
        ctx.restore();
      }
      
      // Hand landmarks per frame
      if (handLandmarkerRef.current) {
        const now = performance.now();
        lastVideoTsRef.current = now;
        const handResult = handLandmarkerRef.current.detectForVideo(videoRef.current, now);
        if (handResult && handResult.landmarks) {
          drawHands(ctx, handResult.landmarks, scale, drawX, drawY);
          drawFingertipMarkers(ctx, handResult.landmarks, scale, drawX, drawY);
        }
      }

      // Draw pose with enhanced tracking using mapped keypoints
      const mappedPoses = poses && poses.length > 0 ? [{ keypoints: poses[0].keypoints.map(kp => ({ ...kp, x: kp.x * scale + drawX, y: kp.y * scale + drawY })) }] : poses;
      drawPose(mappedPoses, ctx);
      
      // Draw collision events as visual feedback
      drawCollisionFeedback(ctx);
      
    } catch (err) {
      console.error('Pose detection error:', err);
    }

    // Use requestAnimationFrame for smooth 60fps tracking
    animationFrameRef.current = requestAnimationFrame(detectPose);
  };

  // Draw MediaPipe hand landmarks and connections
  const drawHands = (ctx, handsLandmarks, scale, drawX, drawY) => {
    const connections = [
      // Thumb
      [0,1],[1,2],[2,3],[3,4],
      // Index
      [0,5],[5,6],[6,7],[7,8],
      // Middle
      [0,9],[9,10],[10,11],[11,12],
      // Ring
      [0,13],[13,14],[14,15],[15,16],
      // Pinky
      [0,17],[17,18],[18,19],[19,20]
    ];

    handsLandmarks.forEach(points => {
      // draw connections
      ctx.strokeStyle = 'rgba(0, 255, 127, 0.9)';
      ctx.lineWidth = 2;
      connections.forEach(([a,b]) => {
        const pa = points[a];
        const pb = points[b];
        // MediaPipe returns normalized [0,1] coords relative to input image
        const ax = pa.x * renderStateRef.current.videoW * scale + drawX;
        const ay = pa.y * renderStateRef.current.videoH * scale + drawY;
        const bx = pb.x * renderStateRef.current.videoW * scale + drawX;
        const by = pb.y * renderStateRef.current.videoH * scale + drawY;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      });
      // draw keypoints
      points.forEach(p => {
        const x = p.x * renderStateRef.current.videoW * scale + drawX;
        const y = p.y * renderStateRef.current.videoH * scale + drawY;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 127, 0.9)';
        ctx.fill();
      });
    });
  };

  // Draw highlighted fingertip markers (thumb, index, middle, ring, pinky tips)
  const drawFingertipMarkers = (ctx, handsLandmarks, scale, drawX, drawY) => {
    const tips = [4, 8, 12, 16, 20];
    handsLandmarks.forEach(points => {
      tips.forEach(i => {
        const p = points[i];
        const x = p.x * renderStateRef.current.videoW * scale + drawX;
        const y = p.y * renderStateRef.current.videoH * scale + drawY;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });
  };

  // Draw collision feedback effects
  const drawCollisionFeedback = (ctx) => {
    collisionEvents.forEach((event, index) => {
      if (Date.now() - event.timestamp < 1000) { // Show for 1 second
        const alpha = 1 - (Date.now() - event.timestamp) / 1000;
        
        // Draw collision effect
        ctx.beginPath();
        ctx.arc(event.position.x, event.position.y, 50, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw collision text
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`HIT!`, event.position.x, event.position.y - 60);
        ctx.fillText(`${event.bodyPart}`, event.position.x, event.position.y - 40);
      }
    });
  };

  const requestCameraPermission = async () => {
    console.log('Button clicked - requesting camera permission');
    setIsLoading(true);
    setError(null);

    try {
      console.log('Calling getUserMedia...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true
      });
      console.log('Camera stream obtained:', stream);

      // Create an off-DOM video element for processing
      if (!videoRef.current) {
        videoRef.current = document.createElement('video');
      }
      const v = videoRef.current;
      v.autoplay = true;
      v.muted = true;
      v.playsInline = true;
      v.srcObject = stream;

      v.onloadedmetadata = async () => {
        console.log('Video metadata loaded, dimensions:', v.videoWidth, 'x', v.videoHeight);
        
        const setupCanvasSizing = () => {
          if (!canvasRef.current) return;
          const dpr = window.devicePixelRatio || 1;
          const cssW = window.innerWidth;
          const cssH = window.innerHeight;
          canvasRef.current.style.width = cssW + 'px';
          canvasRef.current.style.height = cssH + 'px';
          canvasRef.current.width = Math.round(cssW * dpr);
          canvasRef.current.height = Math.round(cssH * dpr);
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          const scale = Math.max(cssW / v.videoWidth, cssH / v.videoHeight);
          const drawW = v.videoWidth * scale;
          const drawH = v.videoHeight * scale;
          const drawX = (cssW - drawW) / 2;
          const drawY = (cssH - drawH) / 2;
          renderStateRef.current = { scale, drawX, drawY, videoW: v.videoWidth, videoH: v.videoHeight };
        };

        setupCanvasSizing();
        resizeHandlerRef.current = setupCanvasSizing;
        window.addEventListener('resize', resizeHandlerRef.current);

        // Initialize pose detection
        await initializePoseDetection();

        setCameraActive(true);
        setIsLoading(false);
      };

      v.onerror = (err) => {
        console.error('Video error:', err);
        setError('Video error');
        setIsLoading(false);
      };
    } catch (err) {
      console.error('Camera error:', err);
      setError('Camera access denied or not available');
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    // Stop pose detection loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Stop camera stream
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setCameraActive(false);
    if (resizeHandlerRef.current) {
      window.removeEventListener('resize', resizeHandlerRef.current);
      resizeHandlerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Update video display when camera becomes active
  useEffect(() => {
    if (cameraActive && videoRef.current) {
      // Make sure the video is visible and playing
      videoRef.current.style.display = 'block';
      videoRef.current.play().catch(err => {
        console.error('Video play error:', err);
      });
      
      // Start pose detection loop
      if (detector) {
        detectPose();
      }
    } else {
      // Stop pose detection loop
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [cameraActive, detector]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative">
      {/* No on-screen <video>; we render camera frames directly into canvas */}
      {/* Light dotted grid background */}
      <div
        className="fixed inset-0 z-0 pointer-events-none [background-image:radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:24px_24px] [background-position:0_0]"
      />
      
      {/* Canvas overlay for pose detection */}
      <canvas
        ref={canvasRef}
        className={cameraActive ? "fixed inset-0 z-10 pointer-events-none" : "hidden"}
        style={{
          transform: cameraActive ? 'scaleX(-1)' : 'none'
        }}
      />

      {/* Control overlay when camera is active */}
      {cameraActive && (
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={stopCamera}
            className="bg-white hover:bg-gray-200 text-black px-4 py-2 rounded font-mono text-sm transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Body tracking stats overlay (collapsible) */}
      {cameraActive && !infoCollapsed && (
        <div className="absolute top-4 left-4 z-20 bg-black/80 text-white p-4 rounded-lg font-mono text-sm max-w-xs">
          <div className="flex items-start justify-between gap-6 mb-2">
            <h3 className="text-lg font-bold text-yellow-400">Body Tracking</h3>
            <button
              onClick={() => setInfoCollapsed(true)}
              className="text-gray-300 hover:text-white w-6 h-6 rounded flex items-center justify-center border border-gray-600 hover:border-gray-400"
              aria-label="Collapse info"
            >
              −
            </button>
          </div>
          
          <div className="space-y-1">
            <div className="text-yellow-300">Primary (Hands):</div>
            <div className="ml-2">
              {trackedBodyParts.left_wrist ? '✓ Left Hand' : '✗ Left Hand'}
            </div>
            <div className="ml-2">
              {trackedBodyParts.right_wrist ? '✓ Right Hand' : '✗ Right Hand'}
            </div>
            
            <div className="text-cyan-300 mt-2">Secondary (Feet):</div>
            <div className="ml-2">
              {trackedBodyParts.left_ankle ? '✓ Left Foot' : '✗ Left Foot'}
            </div>
            <div className="ml-2">
              {trackedBodyParts.right_ankle ? '✓ Right Foot' : '✗ Right Foot'}
            </div>
            
            <div className="text-purple-300 mt-2">Special (Head):</div>
            <div className="ml-2">
              {trackedBodyParts.nose ? '✓ Head' : '✗ Head'}
            </div>
            
            <div className="text-orange-300 mt-2">Tertiary (Joints):</div>
            <div className="ml-2">
              {trackedBodyParts.left_elbow ? '✓ Left Elbow' : '✗ Left Elbow'}
            </div>
            <div className="ml-2">
              {trackedBodyParts.right_elbow ? '✓ Right Elbow' : '✗ Right Elbow'}
            </div>
            <div className="ml-2">
              {trackedBodyParts.left_knee ? '✓ Left Knee' : '✗ Left Knee'}
            </div>
            <div className="ml-2">
              {trackedBodyParts.right_knee ? '✓ Right Knee' : '✗ Right Knee'}
            </div>
          </div>
          
          <div className="mt-3 pt-2 border-t border-gray-600">
            <div className="text-green-300">Collisions: {collisionEvents.length}</div>
            <div className="text-xs text-gray-400 mt-1">
              Try touching the red targets with any tracked body part!
            </div>
            <div className="text-xs text-gray-300 mt-2">
              Hands model: {handLandmarkerRef.current ? 'on' : 'off'}
            </div>
          </div>
        </div>
      )}

      {/* Collapsed floating toggle */}
      {cameraActive && infoCollapsed && (
        <button
          onClick={() => setInfoCollapsed(false)}
          className="absolute top-4 left-4 z-20 bg-black/70 text-white w-8 h-8 rounded-full font-mono text-sm flex items-center justify-center border border-white/20 hover:bg-black/80"
          aria-label="Expand info"
        >
          i
        </button>
      )}

      {/* Button interface when camera is not active */}
      {!cameraActive && (
        <div className="text-center">
          {/* Camera permission button */}
          <div className="space-y-6">
            <button
              onClick={() => {
                console.log('Button clicked!');
                requestCameraPermission();
              }}
              disabled={isLoading}
              className={`
                bg-white hover:bg-gray-200 text-black px-8 py-4 rounded font-mono text-lg
                transition-all duration-200 transform hover:scale-105 active:scale-95
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isLoading ? 'animate-pulse' : ''}
              `}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-3"></div>
                  ...
                </div>
              ) : (
                '○'
              )}
            </button>

            {/* Debug info */}
            <div className="text-white font-mono text-xs mt-4">
              <div>Loading: {isLoading ? 'true' : 'false'}</div>
              <div>Camera Active: {cameraActive ? 'true' : 'false'}</div>
              <div>Error: {error || 'none'}</div>
            </div>

            {/* Error message */}
            {error && (
              <div className="text-white font-mono text-sm">
                ×
              </div>
            )}

            {/* Back to home */}
            <div className="mt-16">
              <a
                href="/"
                className="text-white hover:text-gray-300 font-mono text-sm transition-colors animate-pulse"
              >
                ←
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}