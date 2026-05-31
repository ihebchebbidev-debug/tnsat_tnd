import { useLang } from "@/store/LangContext";
import RevealSection from "./RevealSection";
import stepAccount from "@/assets/step-account.jpg";
import stepRecharge from "@/assets/step-recharge.jpg";
import stepChoose from "@/assets/step-choose.jpg";
import stepEnjoy from "@/assets/step-enjoy.jpg";

const HowItWorks = () => {
  const { t } = useLang();

  const steps = [
    { img: stepAccount, title: t("howStep1Title"), desc: t("howStep1Desc"), step: "01" },
    { img: stepRecharge, title: t("howStep2Title"), desc: t("howStep2Desc"), step: "02" },
    { img: stepChoose, title: t("howStep3Title"), desc: t("howStep3Desc"), step: "03" },
    { img: stepEnjoy, title: t("howStep4Title"), desc: t("howStep4Desc"), step: "04" },
  ];

  return (
    <section className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-secondary/30 relative overflow-hidden">
      <div className="absolute top-0 start-1/4 w-[400px] h-[400px] bg-primary/3 rounded-full blur-[150px]" />
      <div className="max-w-5xl mx-auto relative z-10">
        <RevealSection>
          <div className="text-center mb-12 sm:mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-primary text-xs font-semibold tracking-wide mb-4">
              {t("howItWorksLabel")}
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-foreground mb-3 tracking-tight">{t("howItWorksTitle")}</h2>
            <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">{t("howItWorksSubtitle")}</p>
          </div>
        </RevealSection>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {steps.map((step, i) => (
            <RevealSection key={i} delay={i * 100}>
              <div className="relative bg-card rounded-2xl border border-border p-4 sm:p-6 text-center hover:border-primary/20 hover:shadow-premium hover:-translate-y-1 transition-all duration-300 group h-full">
                <span className="absolute -top-3 start-4 sm:start-6 text-[10px] font-bold text-white gradient-primary px-3 py-1 rounded-lg shadow-glow">
                  {step.step}
                </span>
                <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-5 rounded-xl overflow-hidden bg-secondary/50 ring-2 ring-border group-hover:ring-primary/20 transition-all">
                  <img
                    src={step.img}
                    alt={step.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                    width={80}
                    height={80}
                  />
                </div>
                <h3 className="font-display font-bold text-foreground text-xs sm:text-sm mb-1.5 sm:mb-2">{step.title}</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                {i < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -end-3 sm:-end-4 w-6 h-6 text-muted-foreground/20">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                )}
              </div>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;