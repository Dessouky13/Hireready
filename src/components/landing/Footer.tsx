import Logo from "../Logo";

const Footer = () => {
  return (
    <footer className="border-t-2 border-ink bg-ink py-8 text-primary-foreground">
      <div className="container mx-auto flex flex-col items-center gap-4 px-4 sm:flex-row sm:justify-between">
        <Logo />
        <p className="text-sm text-primary-foreground/50">
          © {new Date().getFullYear()} HireReady. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
