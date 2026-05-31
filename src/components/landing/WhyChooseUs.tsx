import { useLang } from "@/store/LangContext";
import RevealSection from "./RevealSection";


interface Feature {
  img: string;
  title: string;
  desc: string;
}

const WhyChooseUs = ({ features }: { features: Feature[] }) => {
  const { t } = useLang();

  

  return (
    <section className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(228, 35%, 7%) 0%, hsl(260, 40%, 10%) 100%)" }}>
      <div className="absolute top-0 end-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[200px]" />
      <div className="absolute bottom-0 start-0 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[120px]" />
      <div className="max-w-5xl mx-auto relative z-10">
        <RevealSection>
          <div className="text-center mb-12 sm:mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/10 text-accent text-xs font-semibold tracking-wide mb-4">
              {t("products")}
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-white mb-3 tracking-tight">{t("benefitsTitle")}</h2>
          </div>
        </RevealSection>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          {features.map((f, i) => {
            return (
              <RevealSection key={i} delay={i * 120}>
                <div className="group text-center bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 sm:p-8 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-5 sm:mb-6 rounded-2xl overflow-hidden ring-2 ring-white/[0.06] group-hover:ring-primary/30 transition-all duration-300 relative">
                    <img
                      src={f.img}
                      alt={f.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                      width={112}
                      height={112}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  </div>
                  <h3 className="font-display font-bold text-white text-sm sm:text-base mb-2">{f.title}</h3>
                  <p className="text-xs sm:text-sm text-white/35 leading-relaxed max-w-[260px] mx-auto">{f.desc}</p>
                </div>
              </RevealSection>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;