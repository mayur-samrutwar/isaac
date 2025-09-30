import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';

const HandPoseDetection = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detector, setDetector] = useState(null);
  const [debugMode, setDebugMode] = useState(true);
  const [detectionStatus, setDetectionStatus] = useState('Initializing...');
  const [wristCount, setWristCount] = useState(0);
  const animationFrameRef = useRef();

  useEffect(() => {
    let stream = null;

    const initializeCamera = async () => {
      try {
        setDetectionStatus('Requesting camera access...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          
          videoRef.current.onloadedmetadata = () => {
            setDetectionStatus('Camera ready, loading model...');
            console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          };
        }
      } catch (err) {
        setError('Camera access denied or not available');
        setDetectionStatus('Camera error');
        console.error('Camera error:', err);
      }
    };

    const loadPoseModel = async () => {
      try {
        setDetectionStatus('Loading MoveNet model...');
        console.log('Starting MoveNet model loading...');
        
        // Initialize TensorFlow.js
        await tf.ready();
        await tf.setBackend('webgl');
        
        // Load MoveNet model
        const model = poseDetection.SupportedModels.MoveNet;
        const detectorConfig = {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER
        };
        
        console.log('Creating MoveNet detector with config:', detectorConfig);
        const poseDetector = await poseDetection.createDetector(model, detectorConfig);
        console.log('MoveNet model loaded successfully!');
        
        setDetector(poseDetector);
        setDetectionStatus('Model loaded, starting detection...');
        setIsLoading(false);
      } catch (err) {
        setError('Failed to load pose model: ' + err.message);
        setDetectionStatus('Model loading failed');
        console.error('Model loading error:', err);
      }
    };

    const detectPoses = async () => {
      if (!videoRef.current || !canvasRef.current || !detector) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas size to match video
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      try {
        // Detect poses
        const poses = await detector.estimatePoses(video);
        
        const ctx = canvas.getContext('2d');
        
        // Clear canvas with black background
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (poses.length > 0) {
          const pose = poses[0];
          const keypoints = pose.keypoints;
          
          // Find wrist keypoints
          const leftWrist = keypoints.find(kp => kp.name === 'left_wrist');
          const rightWrist = keypoints.find(kp => kp.name === 'right_wrist');
          
          let wristCount = 0;
          if (leftWrist?.score > 0.3) wristCount++;
          if (rightWrist?.score > 0.3) wristCount++;
          
          setWristCount(wristCount);
          setDetectionStatus(`Detected ${wristCount} wrist(s)`);
          
          // Draw hand landmarks and connections
          drawHandSkeleton(ctx, keypoints);
          
          // Draw wrist impact areas
          if (leftWrist?.score > 0.3) {
            drawWristArea(ctx, leftWrist.x, leftWrist.y, 'left');
          }
          if (rightWrist?.score > 0.3) {
            drawWristArea(ctx, rightWrist.x, rightWrist.y, 'right');
          }
        } else {
          setDetectionStatus('No poses detected - try different angles or lighting');
          setWristCount(0);
          
          // In debug mode, show the video feed
          if (debugMode) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        }
      } catch (err) {
        console.error('Detection error:', err);
        setDetectionStatus('Detection error: ' + err.message);
      }

      // Request next frame
      animationFrameRef.current = requestAnimationFrame(detectPoses);
    };

    const drawWristArea = (ctx, x, y, side) => {
      // Draw wrist impact area
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw wrist center point
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = 'white';
      ctx.fill();
    };

    const drawHandSkeleton = (ctx, keypoints) => {
      // Set drawing style for white lines and nodes
      ctx.strokeStyle = 'white';
      ctx.fillStyle = 'white';
      ctx.lineWidth = 2;

      // Draw all keypoints as white dots
      keypoints.forEach((keypoint) => {
        if (keypoint.score > 0.3) {
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      });

      // Draw connections between keypoints (simplified skeleton)
      const connections = [
        // Head and shoulders
        ['left_shoulder', 'right_shoulder'],
        ['left_shoulder', 'left_elbow'],
        ['right_shoulder', 'right_elbow'],
        ['left_elbow', 'left_wrist'],
        ['right_elbow', 'right_wrist'],
        // Torso
        ['left_shoulder', 'left_hip'],
        ['right_shoulder', 'right_hip'],
        ['left_hip', 'right_hip'],
        // Legs
        ['left_hip', 'left_knee'],
        ['right_hip', 'right_knee'],
        ['left_knee', 'left_ankle'],
        ['right_knee', 'right_ankle'],
      ];

      connections.forEach(([startName, endName]) => {
        const startPoint = keypoints.find(kp => kp.name === startName);
        const endPoint = keypoints.find(kp => kp.name === endName);
        
        if (startPoint?.score > 0.3 && endPoint?.score > 0.3) {
          ctx.beginPath();
          ctx.moveTo(startPoint.x, startPoint.y);
          ctx.lineTo(endPoint.x, endPoint.y);
          ctx.stroke();
        }
      });
    };

    const initialize = async () => {
      await initializeCamera();
      await loadPoseModel();
      
      // Start detection loop
      setTimeout(() => {
        detectPoses();
      }, 1000);
    };

    initialize();

    // Cleanup
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Camera Error</h2>
          <p className="text-gray-300">{error}</p>
          <p className="text-sm text-gray-400 mt-2">
            Please allow camera access and refresh the page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative">
      {isLoading && (
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading pose detection...</p>
          <p className="text-sm text-gray-300 mt-2">{detectionStatus}</p>
        </div>
      )}
      
      <div className="relative">
        {/* Hidden video element for camera feed */}
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          muted
        />
        
        {/* Canvas for drawing pose landmarks */}
        <canvas
          ref={canvasRef}
          className="border border-gray-600 rounded-lg"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
        
        {/* Debug info overlay */}
        <div className="absolute top-4 left-4 text-white text-sm bg-black bg-opacity-75 p-3 rounded">
          <div className="mb-2">
            <p className="font-bold">Status: {detectionStatus}</p>
            <p className="text-gray-300">Wrists detected: {wristCount}</p>
          </div>
          
          <div className="mb-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(e) => setDebugMode(e.target.checked)}
                className="mr-2"
              />
              <span className="text-xs">Debug mode (show camera feed)</span>
            </label>
          </div>
          
          <div className="text-xs text-gray-400">
            <p>• Ensure good lighting</p>
            <p>• Keep hands visible in frame</p>
            <p>• Try different angles</p>
            <p>• Check browser console for errors</p>
          </div>
        </div>
        
        {/* Instructions overlay */}
        <div className="absolute bottom-4 left-4 text-white text-sm bg-black bg-opacity-50 p-2 rounded">
          <p>Show your hands to the camera</p>
          <p className="text-gray-300">White lines show pose detection</p>
        </div>
      </div>
    </div>
  );
};

export default HandPoseDetection;
