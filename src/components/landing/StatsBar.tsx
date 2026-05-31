import RevealSection from "./RevealSection";

interface Stat {
  img: string;
  value: string;
  label: string;
}

const StatsBar = ({ stats }: { stats: Stat[] }) => {
  return (
    <section className="relative -mt-8 sm:-mt-10 z-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
          {stats.map((stat, i) => (
            <RevealSection
              key={i}
              delay={i * 80}
              className={`flex items-center gap-3 px-4 sm:px-6 py-5 sm:py-6 justify-center hover:bg-secondary/30 transition-all duration-300 ${
                i % 2 !== 0 ? "border-s border-border" : ""
              } ${i >= 2 ? "border-t border-border md:border-t-0" : ""} ${
                i >= 1 ? "md:border-s md:border-border" : ""
              }`}
            >
              <img
                src={stat.img}
                alt={stat.label}
                className="w-9 h-9 sm:w-10 sm:h-10 object-contain flex-shrink-0"
                loading="lazy"
                width={40}
                height={40}
              />
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-display font-bold text-foreground leading-tight">{stat.value}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground font-semibold uppercase tracking-wider truncate">{stat.label}</p>
              </div>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsBar;