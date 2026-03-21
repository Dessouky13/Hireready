import { Link } from "react-router-dom";

const CTABanner = () => {
  return (
    <section className="border-y-2 border-ink bg-primary py-16 text-primary-foreground">
      <div className="container mx-auto px-4 text-center">
        <h2 className="mb-4 font-heading text-3xl font-extrabold md:text-5xl">
          Ready to{" "}
          <span className="relative inline-block">
            <span className="absolute inset-0 -skew-x-3 bg-lime rounded-md" />
            <span className="relative z-10 px-3 text-lime-foreground">ace your next interview?</span>
          </span>
        </h2>
        <p className="mx-auto mb-8 max-w-md text-primary-foreground/70">
          Join 2,400+ students who stopped freezing and started getting offers.
        </p>
        <Link to="/auth/signup" className="neo-btn bg-background text-foreground text-base">
          Start Practicing — It's Free
        </Link>
      </div>
    </section>
  );
};

export default CTABanner;
