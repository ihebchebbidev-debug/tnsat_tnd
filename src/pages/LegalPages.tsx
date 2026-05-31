import { useLang } from "@/store/LangContext";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, Shield, RefreshCw } from "lucide-react";
import type { TranslationKey } from "@/utils/translations";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

interface LegalSection {
  titleKey: TranslationKey;
  contentKey: TranslationKey;
}

const RevealDiv = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const { ref, isVisible } = useScrollReveal(0.1);
  return (
    <div
      ref={ref}
      className="transition-all duration-600 ease-out"
      style={{
        transitionDelay: `${delay}ms`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(16px)",
      }}
    >
      {children}
    </div>
  );
};

const LegalPage = ({
  titleKey,
  introKey,
  sections,
  icon: Icon,
}: {
  titleKey: TranslationKey;
  introKey: TranslationKey;
  sections: LegalSection[];
  icon: React.ElementType;
}) => {
  const { t } = useLang();

  return (
    <div className="min-h-screen bg-secondary/20">
      {/* Header */}
      <div className="bg-hero-dark">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground/60 hover:text-primary-foreground/80 transition-colors mb-8 group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            {t("home")}
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl gradient-primary shadow-glow flex-shrink-0">
              <Icon className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-primary-foreground mb-2">{t(titleKey)}</h1>
              <p className="text-sm text-muted-foreground/50">
                {t("termsLastUpdated")}: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-4">
        <div className="bg-card rounded-2xl border border-border shadow-premium p-6 sm:p-10">
          {/* Intro */}
          <RevealDiv>
            <div className="flex gap-4 p-5 rounded-xl bg-primary/5 border border-primary/10 mb-10">
              <div className="w-1 rounded-full gradient-primary flex-shrink-0" />
              <p className="text-foreground/80 leading-relaxed text-[15px]">{t(introKey)}</p>
            </div>
          </RevealDiv>

          {/* Sections */}
          <div className="space-y-8">
            {sections.map((section, i) => (
              <RevealDiv key={i} delay={i * 60}>
                <div className="group">
                  <h2 className="text-lg font-display font-bold text-foreground mb-3 flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/5 text-primary text-xs font-bold">{i + 1}</span>
                    {t(section.titleKey).replace(/^\d+\.\s*/, '')}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed pl-10">{t(section.contentKey)}</p>
                </div>
              </RevealDiv>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-20" />
    </div>
  );
};

export const TermsPage = () => (
  <LegalPage
    titleKey="termsTitle"
    introKey="termsIntro"
    icon={FileText}
    sections={[
      { titleKey: "termsSection1Title", contentKey: "termsSection1Content" },
      { titleKey: "termsSection2Title", contentKey: "termsSection2Content" },
      { titleKey: "termsSection3Title", contentKey: "termsSection3Content" },
      { titleKey: "termsSection4Title", contentKey: "termsSection4Content" },
      { titleKey: "termsSection5Title", contentKey: "termsSection5Content" },
      { titleKey: "termsSection6Title", contentKey: "termsSection6Content" },
      { titleKey: "termsSection7Title", contentKey: "termsSection7Content" },
      { titleKey: "termsSection8Title", contentKey: "termsSection8Content" },
    ]}
  />
);

export const PrivacyPage = () => (
  <LegalPage
    titleKey="privacyTitle"
    introKey="privacyIntro"
    icon={Shield}
    sections={[
      { titleKey: "privacySection1Title", contentKey: "privacySection1Content" },
      { titleKey: "privacySection2Title", contentKey: "privacySection2Content" },
      { titleKey: "privacySection3Title", contentKey: "privacySection3Content" },
      { titleKey: "privacySection4Title", contentKey: "privacySection4Content" },
      { titleKey: "privacySection5Title", contentKey: "privacySection5Content" },
      { titleKey: "privacySection6Title", contentKey: "privacySection6Content" },
      { titleKey: "privacySection7Title", contentKey: "privacySection7Content" },
    ]}
  />
);

export const RefundPage = () => (
  <LegalPage
    titleKey="refundTitle"
    introKey="refundIntro"
    icon={RefreshCw}
    sections={[
      { titleKey: "refundSection1Title", contentKey: "refundSection1Content" },
      { titleKey: "refundSection2Title", contentKey: "refundSection2Content" },
      { titleKey: "refundSection3Title", contentKey: "refundSection3Content" },
      { titleKey: "refundSection4Title", contentKey: "refundSection4Content" },
      { titleKey: "refundSection5Title", contentKey: "refundSection5Content" },
    ]}
  />
);
