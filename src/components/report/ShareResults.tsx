import { useRef, useState } from "react";
import { Download, Linkedin, Facebook, Twitter, Instagram } from "lucide-react";

interface ShareResultsProps {
  overallScore: number;
  confScore: number;
  clarityScore: number;
  structScore: number;
  commScore: number;
  role: string;
  date: string;
}

const generateShareText = (props: ShareResultsProps) => {
  const conf10 = Math.round(props.confScore / 10);
  const clarity10 = Math.round(props.clarityScore / 10);
  const story10 = Math.round(props.structScore / 10);
  const comm10 = Math.round(props.commScore / 10);

  return `I just tested my interview skills with AI on HireReady 🤖

Role: ${props.role}

Interview Score: ${props.overallScore}/100

Confidence: ${conf10}/10
Clarity: ${clarity10}/10
Storytelling: ${story10}/10
Communication: ${comm10}/10

Can you beat my score?

Try it here: https://hireready.ai`;
};

const generateShareCard = (props: ShareResultsProps): Promise<string> => {
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
      // Label
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "500 22px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(s.label, barX, y - 8);
      // Value
      ctx.textAlign = "right";
      ctx.fillStyle = "#a78bfa";
      ctx.fillText(`${Math.round(s.value / 10)}/10`, barX + barW, y - 8);
      // Bar bg
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.roundRect(barX, y, barW, barH, 12);
      ctx.fill();
      // Bar fill
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

    resolve(canvas.toDataURL("image/png"));
  });
};

const ShareResults = (props: ShareResultsProps) => {
  const [downloading, setDownloading] = useState(false);
  const shareText = generateShareText(props);
  const encodedText = encodeURIComponent(shareText);
  const siteUrl = encodeURIComponent("https://hireready.ai");

  const shareLinks = {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${siteUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${siteUrl}&quote=${encodedText}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
  };

  const handleInstagramShare = async () => {
    setDownloading(true);
    try {
      const dataUrl = await generateShareCard(props);
      const link = document.createElement("a");
      link.download = "hireready-score.png";
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  const buttons = [
    {
      label: "LinkedIn",
      icon: Linkedin,
      onClick: () => window.open(shareLinks.linkedin, "_blank", "width=600,height=600"),
      className: "bg-[#0A66C2] hover:bg-[#004182] text-white",
    },
    {
      label: "Facebook",
      icon: Facebook,
      onClick: () => window.open(shareLinks.facebook, "_blank", "width=600,height=600"),
      className: "bg-[#1877F2] hover:bg-[#0d5bbf] text-white",
    },
    {
      label: "X (Twitter)",
      icon: Twitter,
      onClick: () => window.open(shareLinks.twitter, "_blank", "width=600,height=600"),
      className: "bg-foreground hover:bg-foreground/80 text-background",
    },
    {
      label: "Instagram",
      icon: Instagram,
      onClick: handleInstagramShare,
      className: "bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-90 text-white",
    },
  ];

  return (
    <div className="neo-card mb-8 bg-card p-6 md:p-8">
      <div className="mb-6 text-center">
        <h3 className="mb-2 font-heading text-2xl font-bold">Share Your Results 🚀</h3>
        <p className="text-muted-foreground">
          Challenge your friends to beat your AI interview score.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {buttons.map((btn) => (
          <button
            key={btn.label}
            onClick={btn.onClick}
            disabled={btn.label === "Instagram" && downloading}
            className={`neo-btn flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${btn.className}`}
          >
            <btn.icon className="h-5 w-5" />
            <span className="hidden sm:inline">{btn.label}</span>
          </button>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        📸 Instagram: Download the share card image and post it to your Stories or Feed.
      </p>
    </div>
  );
};

export default ShareResults;
