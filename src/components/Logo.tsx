const Logo = ({ size = "default" }: { size?: "default" | "large" }) => {
  const textClass = size === "large" ? "text-2xl" : "text-xl";
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-blink rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
      </span>
      <span className={`font-heading font-extrabold text-foreground ${textClass}`}>
        HireReady
      </span>
    </div>
  );
};

export default Logo;
