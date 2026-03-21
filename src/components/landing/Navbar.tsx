import { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../Logo";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-ink bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center">
          <Logo />
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-8 md:flex">
          <a href="#how-it-works" className="font-body text-sm font-semibold text-foreground hover:text-primary transition-colors">How it works</a>
          <a href="#features" className="font-body text-sm font-semibold text-foreground hover:text-primary transition-colors">Features</a>
          <a href="#pricing" className="font-body text-sm font-semibold text-foreground hover:text-primary transition-colors">Pricing</a>
          <Link to="/auth/signup" className="neo-btn bg-primary text-primary-foreground">
            Try for free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className="md:hidden p-2">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t-2 border-ink bg-background p-4 md:hidden">
          <div className="flex flex-col gap-4">
            <a href="#how-it-works" onClick={() => setOpen(false)} className="font-body font-semibold">How it works</a>
            <a href="#features" onClick={() => setOpen(false)} className="font-body font-semibold">Features</a>
            <a href="#pricing" onClick={() => setOpen(false)} className="font-body font-semibold">Pricing</a>
            <Link to="/auth/signup" onClick={() => setOpen(false)} className="neo-btn bg-primary text-primary-foreground text-center">
              Try for free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
