import { useState } from "react";
import { Download } from "lucide-react";

interface DownloadShareCardProps {
  overallScore: number;
  confScore: number;
  clarityScore: number;
  structScore: number;
  commScore: number;
  role: string;
}

const generateShareCardJPG = (props: DownloadShareCardProps): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
    bgGrad.addColorStop(0, "#0f0f1a");
    bgGrad.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Card
    const cardX = 80, cardY = 120, cardW = 920, cardH = 840, r = 32;
    ctx.beginPath();
    ctx.moveTo(cardX + r, cardY);
    ctx.lineTo(cardX + cardW - r, cardY);
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
    ctx.lineTo(cardX + cardW, cardY + cardH - r);
    ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
    ctx.lineTo(cardX + r, cardY + cardH);
    ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
    ctx.lineTo(cardX, cardY + r);
    ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
    ctx.closePath();
    const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    cardGrad.addColorStop(0, "rgba(255,255,255,0.08)");
    cardGrad.addColorStop(1, "rgba(255,255,255,0.03)");
    ctx.fillStyle = cardGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Title
    ctx.fillStyle = "#a78bfa";
    ctx.font = "bold 36px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AI Interview Score", 540, 200);

    // Role
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 28px system-ui, -apple-system, sans-serif";
    ctx.fillText(props.role, 540, 260);

    // Big score
    const scoreGrad = ctx.createLinearGradient(440, 300, 640, 420);
    scoreGrad.addColorStop(0, "#a78bfa");
    scoreGrad.addColorStop(1, "#60a5fa");
    ctx.fillStyle = scoreGrad;
    ctx.font = "900 120px system-ui, -apple-system, sans-serif";
    ctx.fillText(`${props.overallScore}`, 540, 420);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "600 32px system-ui, -apple-system, sans-serif";
    ctx.fillText("/ 100", 540, 465);

    // Score bars
    const scores = [
      { label: "Confidence", value: props.confScore },
      { label: "Clarity", value: props.clarityScore },
      { label: "Storytelling", value: props.structScore },
      { label: "Communication", value: props.commScore },
    ];

    const barStartY = 520;
    const barH = 24;
    const barGap = 70;
    const barX = 180;
    const barW = 720;

    scores.forEach((s, i) => {
      const y = barStartY + i * barGap;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "500 22px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(s.label, barX, y - 8);
      ctx.textAlign = "right";
      ctx.fillStyle = "#a78bfa";
      ctx.fillText(`${Math.round(s.value / 10)}/10`, barX + barW, y - 8);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.roundRect(barX, y, barW, barH, 12);
      ctx.fill();
      const fillGrad = ctx.createLinearGradient(barX, y, barX + barW, y);
      fillGrad.addColorStop(0, "#a78bfa");
      fillGrad.addColorStop(1, "#60a5fa");
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      ctx.roundRect(barX, y, (barW * s.value) / 100, barH, 12);
      ctx.fill();
    });

    // Footer
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "500 24px system-ui, -apple-system, sans-serif";
    ctx.fillText("Test yourself on HireReady", 540, 920);
    ctx.fillStyle = "#a78bfa";
    ctx.font = "600 22px system-ui, -apple-system, sans-serif";
    ctx.fillText("hireready.ai", 540, 955);

    // Convert to JPEG
    resolve(canvas.toDataURL("image/jpeg", 0.95));
  });
};

const DownloadShareCard = (props: DownloadShareCardProps) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const dataUrl = await generateShareCardJPG(props);
      const link = document.createElement("a");
      link.download = `hireready-${props.role.toLowerCase().replace(/\s+/g, "-")}-score.jpg`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="neo-btn flex items-center gap-1 bg-accent text-accent-foreground text-xs px-3 py-1.5"
      title="Download share card"
    >
      <Download className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{downloading ? "..." : "Share"}</span>
    </button>
  );
};

export default DownloadShareCard;
