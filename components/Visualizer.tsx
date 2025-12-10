import React, { useEffect, useRef } from 'react';
import { AudioVisualizerProps } from '../types';

const Visualizer: React.FC<AudioVisualizerProps> = ({ analyser, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#0f172a'; // Match background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;

        // Gradient based on activity
        const r = 50 + (barHeight + (25 * (i / bufferLength)));
        const g = 100 + (barHeight * 2);
        const b = 255;

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        
        // Center the visualization vertically
        const y = (canvas.height - barHeight) / 2;
        
        ctx.fillRect(x, y, barWidth, barHeight);
        // Reflection
        ctx.fillStyle = `rgba(${r},${g},${b}, 0.2)`;
        ctx.fillRect(x, y + barHeight, barWidth, barHeight / 2);

        x += barWidth + 1;
      }
    };

    if (isActive) {
      draw();
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw a flat line when inactive
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={150}
      className="w-full h-32 rounded-lg bg-slate-900 shadow-inner border border-slate-800"
    />
  );
};

export default Visualizer;