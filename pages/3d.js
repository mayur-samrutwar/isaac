import { useState, useRef, useEffect } from 'react';

export default function ThreeD() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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

      if (videoRef.current) {
        console.log('Setting video source...');
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          setCameraActive(true);
          setIsLoading(false);
        };

        videoRef.current.oncanplay = () => {
          console.log('Video can play');
        };

        videoRef.current.onerror = (err) => {
          console.error('Video error:', err);
          setError('Video error');
          setIsLoading(false);
        };
      } else {
        console.error('Video ref is null');
        setError('Video element not found');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Camera access denied or not available');
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
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
    }
  }, [cameraActive]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative">
      {/* Video element - always present */}
      <video
        ref={videoRef}
        className={cameraActive ? "w-full h-screen object-cover absolute top-0 left-0 z-10" : "hidden"}
        style={{ 
          transform: cameraActive ? 'scaleX(-1)' : 'none'
        }}
        autoPlay
        playsInline
        muted
      />
      
      {/* Canvas overlay - always present */}
      <canvas
        ref={canvasRef}
        className="hidden"
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