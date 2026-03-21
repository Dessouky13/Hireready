import { useEffect, useRef } from "react";

interface AIOrbProps {
  state: "idle" | "listening" | "thinking" | "speaking";
  size?: number;
}

/**
 * Animated AI orb visualizer for the interview screen.
 * Uses pure CSS animations with dynamic scaling based on state.
 */
const AIOrb = ({ state, size = 180 }: AIOrbProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Color configs per state
  const stateConfig = {
    idle: {
      core: "rgba(99, 102, 241, 0.6)",    // indigo / primary
      glow: "rgba(99, 102, 241, 0.15)",
      ring: "rgba(99, 102, 241, 0.3)",
      pulse: 0.3,
      speed: 0.5,
    },
    listening: {
      core: "rgba(163, 230, 53, 0.7)",     // lime / accent
      glow: "rgba(163, 230, 53, 0.15)",
      ring: "rgba(163, 230, 53, 0.3)",
      pulse: 0.5,
      speed: 0.8,
    },
    thinking: {
      core: "rgba(168, 85, 247, 0.7)",     // purple
      glow: "rgba(168, 85, 247, 0.15)",
      ring: "rgba(168, 85, 247, 0.3)",
      pulse: 0.7,
      speed: 1.5,
    },
    speaking: {
      core: "rgba(59, 130, 246, 0.8)",     // blue / primary-like
      glow: "rgba(59, 130, 246, 0.2)",
      ring: "rgba(59, 130, 246, 0.4)",
      pulse: 1.0,
      speed: 1.2,
    },
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasSize = size + 80; // Extra space for glow
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    ctx.scale(dpr, dpr);

    const cx = canvasSize / 2;
    const cy = canvasSize / 2;
    const baseRadius = size / 2 - 10;
    let time = 0;

    const draw = () => {
      const config = stateConfig[state];
      time += 0.016 * config.speed;

      ctx.clearRect(0, 0, canvasSize, canvasSize);

      // Outer glow pulse
      const glowScale = 1 + Math.sin(time * 2) * 0.08 * config.pulse;
      const glowRadius = baseRadius * glowScale + 25;
      const glowGrad = ctx.createRadialGradient(cx, cy, baseRadius * 0.5, cx, cy, glowRadius);
      glowGrad.addColorStop(0, config.glow);
      glowGrad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // Animated rings
      for (let i = 0; i < 3; i++) {
        const ringPhase = time * (1 + i * 0.3) + i * (Math.PI * 2) / 3;
        const ringScale = 1 + Math.sin(ringPhase) * 0.06 * config.pulse;
        const ringRadius = baseRadius * ringScale + i * 8;
        const alpha = 0.15 - i * 0.04;

        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = config.ring.replace("0.3", alpha.toFixed(2));
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Core orb with gradient
      const orbScale = 1 + Math.sin(time * 3) * 0.03 * config.pulse;
      const orbRadius = baseRadius * 0.65 * orbScale;

      const coreGrad = ctx.createRadialGradient(
        cx - orbRadius * 0.3,
        cy - orbRadius * 0.3,
        0,
        cx,
        cy,
        orbRadius
      );
      coreGrad.addColorStop(0, "rgba(255, 255, 255, 0.25)");
      coreGrad.addColorStop(0.4, config.core);
      coreGrad.addColorStop(1, config.core.replace(/[\d.]+\)$/, "0.2)"));

      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Inner shine highlight
      const shineGrad = ctx.createRadialGradient(
        cx - orbRadius * 0.25,
        cy - orbRadius * 0.3,
        0,
        cx - orbRadius * 0.2,
        cy - orbRadius * 0.2,
        orbRadius * 0.5
      );
      shineGrad.addColorStop(0, "rgba(255, 255, 255, 0.3)");
      shineGrad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius, 0, Math.PI * 2);
      ctx.fillStyle = shineGrad;
      ctx.fill();

      // Speaking: animated wave bars around the orb
      if (state === "speaking") {
        const barCount = 24;
        for (let i = 0; i < barCount; i++) {
          const angle = (i / barCount) * Math.PI * 2;
          const barHeight = 4 + Math.sin(time * 4 + i * 0.8) * 8 * config.pulse;
          const barStart = orbRadius + 12;
          const barEnd = barStart + Math.max(2, barHeight);

          const x1 = cx + Math.cos(angle) * barStart;
          const y1 = cy + Math.sin(angle) * barStart;
          const x2 = cx + Math.cos(angle) * barEnd;
          const y2 = cy + Math.sin(angle) * barEnd;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = config.ring;
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }

      // Thinking: rotating dots
      if (state === "thinking") {
        const dotCount = 6;
        for (let i = 0; i < dotCount; i++) {
          const angle = time * 2 + (i / dotCount) * Math.PI * 2;
          const dotRadius = orbRadius + 16;
          const dx = cx + Math.cos(angle) * dotRadius;
          const dy = cy + Math.sin(angle) * dotRadius;
          const dotAlpha = 0.3 + Math.sin(time * 3 + i) * 0.3;

          ctx.beginPath();
          ctx.arc(dx, dy, 3, 0, Math.PI * 2);
          ctx.fillStyle = config.core.replace(/[\d.]+\)$/, `${dotAlpha})`);
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [state, size]);

  const canvasSize = size + 80;

  return (
    <div className="relative flex items-center justify-center" style={{ width: canvasSize, height: canvasSize }}>
      <canvas
        ref={canvasRef}
        style={{ width: canvasSize, height: canvasSize }}
        className="absolute inset-0"
      />
      {/* State label */}
      <div className="absolute -bottom-2 flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            state === "speaking"
              ? "bg-primary animate-pulse"
              : state === "thinking"
              ? "bg-purple animate-pulse"
              : state === "listening"
              ? "bg-accent animate-pulse"
              : "bg-muted-foreground/50"
          }`}
        />
        <span className="font-heading text-xs font-semibold uppercase tracking-wider text-primary-foreground/60">
          {state === "speaking"
            ? "Speaking"
            : state === "thinking"
            ? "Thinking..."
            : state === "listening"
            ? "Listening"
            : "Ready"}
        </span>
      </div>
    </div>
  );
};

export default AIOrb;
