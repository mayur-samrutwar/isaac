import { useState, useEffect } from 'react';

export default function Home() {
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationStep(prev => (prev + 1) % 3);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const asciiArt = [
    `    ██╗███████╗ █████╗  █████╗  ██████╗ 
    ██║██╔════╝██╔══██╗██╔══██╗██╔════╝ 
    ██║███████╗███████║███████║██║  ███╗
    ██║╚════██║██╔══██║██╔══██║██║   ██║
    ██║███████║██║  ██║██║  ██║╚██████╔╝
    ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ `,
    
    `    ██╗███████╗ █████╗  █████╗  ██████╗ 
    ██║██╔════╝██╔══██╗██╔══██╗██╔════╝ 
    ██║███████╗███████║███████║██║  ███╗
    ██║╚════██║██╔══██║██╔══██║██║   ██║
    ██║███████║██║  ██║██║  ██║╚██████╔╝
    ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ `,
    
    `    ██╗███████╗ █████╗  █████╗  ██████╗ 
    ██║██╔════╝██╔══██╗██╔══██╗██╔════╝ 
    ██║███████╗███████║███████║██║  ███╗
    ██║╚════██║██╔══██║██╔══██║██║   ██║
    ██║███████║██║  ██║██║  ██║╚██████╔╝
    ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ `
  ];

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      {/* Minimal animated background */}
      <div className="absolute inset-0 opacity-5">
        <div className="grid grid-cols-40 grid-rows-40 h-full w-full">
          {Array.from({ length: 1600 }).map((_, i) => (
            <div
              key={i}
              className="border border-white animate-pulse"
              style={{
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Main ASCII Art */}
      <div className="text-center">
        <pre className="text-white font-mono text-sm md:text-lg lg:text-xl xl:text-2xl leading-tight animate-pulse">
          {asciiArt[animationStep]}
        </pre>
        
        {/* Simple navigation */}
        <div className="mt-16">
          <a 
            href="/3d" 
            className="text-white hover:text-gray-300 font-mono text-sm transition-colors animate-pulse"
          >
            →
          </a>
        </div>
      </div>
    </div>
  );
}
