import { useEffect, useState } from "react";

interface VoiceVisualizerProps {
  isActive: boolean;
  color: "primary" | "accent";
}

const VoiceVisualizer = ({ isActive, color }: VoiceVisualizerProps) => {
  const [bars, setBars] = useState([0.3, 0.5, 0.7, 0.5, 0.3]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setBars(bars.map(() => 0.2 + Math.random() * 0.8));
    }, 150);
    return () => clearInterval(interval);
  }, [isActive]);

  const ringColor = color === "primary" ? "bg-primary" : "bg-accent";

  return (
    <div className="absolute -bottom-6 flex items-end gap-1">
      {bars.map((h, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-150 ${ringColor}`}
          style={{ height: `${h * 24}px` }}
        />
      ))}
    </div>
  );
};

export default VoiceVisualizer;
