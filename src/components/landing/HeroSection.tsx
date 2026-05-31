import { useLang } from "@/store/LangContext";
import { Link } from "react-router-dom";
import { ArrowRight, Shield, Handshake, Users, Globe, Zap, Star, TrendingUp } from "lucide-react";
import heroImg from "@/assets/hero-new.jpg";

const HeroSection = () => {
  const { t } = useLang();

  return (
    <section className="relative min-h-[600px] md:min-h-[700px] flex items-center overflow-hidden" style={{ background: "hsl(228, 35%, 6%)" }}>
      <img src={heroImg} alt="TNSAT Platform" className="absolute inset-0 w-full h-full object-cover opacity-20 scale-105" width={1920} height={1080} />
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(228,35%,6%)] via-[hsl(228,35%,6%)/0.92] to-[hsl(260,50%,15%)/0.7]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(228,35%,6%)] via-transparent to-transparent" />
      <div className="absolute top-20 end-[15%] w-[400px] h-[400px] rounded-full bg-primary/8 blur-[120px] animate-float" />
      <div className="absolute bottom-10 start-[10%] w-[300px] h-[300px] rounded-full bg-[hsl(260,70%,58%)]/8 blur-[100px] animate-float" style={{ animationDelay: "3s" }} />
      <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(hsl(var(--primary-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary-foreground)) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-20 md:py-28 w-full">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-up inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-primary/25 bg-primary/[0.08] mb-8 backdrop-blur-sm">
            <span className="relative flex items-center justify-center w-5 h-5">
              <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" style={{ animationDuration: "2s" }} />
              <Shield className="h-3 w-3 text-primary relative z-10" />
            </span>
            <span className="text-primary/90 text-xs font-semibold tracking-wide">{t("heroBadge")}</span>
            <span className="w-px h-3 bg-primary/20" />
            <span className="flex items-center gap-1 text-xs text-primary/60"><Star className="h-3 w-3 fill-primary/60" /> 4.9/5</span>
          </div>

          <h1 className="animate-fade-up text-[2.5rem] sm:text-5xl lg:text-[4rem] font-display font-bold leading-[1.08] tracking-tight mb-6" style={{ animationDelay: "80ms" }}>
            <span className="text-white">{t("heroTitleB2B1")}</span>{" "}
            <span className="gradient-text">{t("heroTitleB2B2")}</span>
          </h1>

          <p className="animate-fade-up text-base sm:text-lg text-white/40 leading-relaxed mb-10 max-w-2xl mx-auto" style={{ animationDelay: "160ms" }}>
            {t("heroSubtitleB2B")}
          </p>

          <div className="animate-fade-up flex flex-col xs:flex-row gap-4 mb-16 justify-center" style={{ animationDelay: "240ms" }}>
            <Link to="/login" className="inline-flex items-center justify-center gap-2.5 h-14 px-10 rounded-2xl gradient-primary text-primary-foreground text-sm font-bold shadow-glow hover:shadow-[0_8px_40px_-4px_hsl(var(--primary)/0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 group">
              {t("heroCtaB2B")}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#how-it-works" className="inline-flex items-center justify-center gap-2 h-14 px-10 rounded-2xl border border-white/10 text-white/60 text-sm font-semibold hover:text-white hover:border-white/25 hover:bg-white/5 backdrop-blur-sm transition-all duration-300">
              {t("heroSecondaryB2B")}
            </a>
          </div>

        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default HeroSection;
