const items = [
  "Software Engineering", "Product Management", "Data Science", "UX Design",
  "Marketing", "Finance", "DevOps", "AI/ML", "Business Analysis", "Frontend Development",
  "Backend Development", "Cloud Architecture", "Cybersecurity", "Mobile Development",
];

const Marquee = () => {
  return (
    <div className="overflow-hidden border-y-2 border-ink bg-ink py-4">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="mx-8 font-heading text-sm font-bold uppercase text-primary-foreground/70">
            {item} <span className="text-primary">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default Marquee;
