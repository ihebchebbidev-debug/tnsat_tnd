import { useLang } from "@/store/LangContext";
import { Link } from "react-router-dom";
import { ArrowRight, Shield, Zap, Headphones, Star } from "lucide-react";
import RevealSection from "./RevealSection";

const CtaSection = () => {
  const { t } = useLang();

  return (
    <section className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-8">
      <RevealSection>
        <div className="max-w-3xl mx-auto relative overflow-hidden rounded-3xl p-8 sm:p-12 md:p-16 text-center border border-white/[0.06]" style={{ background: "linear-gradient(135deg, hsl(228, 35%, 7%) 0%, hsl(260, 40%, 12%) 50%, hsl(228, 35%, 10%) 100%)" }}>
          {/* Decorative orbs */}
          <div className="absolute top-0 start-0 w-56 h-56 bg-primary/15 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 end-0 w-40 h-40 bg-accent/10 rounded-full blur-[80px]" />
          <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[1px] bg-gradient-to-r from-transparent via-primary/10 to-transparent rotate-12" />

          <div className="relative z-10">
            {/* Rating badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] mb-6 sm:mb-8">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="text-[10px] text-white/40 ms-1 font-medium">4.9/5</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-white mb-4 sm:mb-5 tracking-tight leading-tight">{t("ctaTitle")}</h2>
            <p className="text-white/35 text-sm sm:text-base mb-8 sm:mb-10 max-w-md mx-auto leading-relaxed">{t("ctaSubtitle")}</p>

            <Link
              to="/login"
              className="inline-flex items-center gap-2.5 h-14 px-10 text-sm font-bold rounded-2xl gradient-primary text-white shadow-glow hover:shadow-[0_8px_40px_-4px_hsl(var(--primary)/0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 group"
            >
              {t("ctaButton")}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-5 sm:gap-6 mt-8 sm:mt-10">
              {[
                { icon: Shield, label: t("ctaFeature1") },
                { icon: Zap, label: t("ctaFeature2") },
                { icon: Headphones, label: t("ctaFeature3") },
              ].map((item, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-xs text-white/30">
                  <span className="flex items-center justify-center w-6 h-6 rounded-md bg-white/[0.04] border border-white/[0.06]">
                    <item.icon className="h-3 w-3 text-primary/60" />
                  </span>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>
    </section>
  );
};

export default CtaSection;