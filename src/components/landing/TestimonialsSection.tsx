import { useLang } from "@/store/LangContext";
import { Star, Quote } from "lucide-react";
import RevealSection from "./RevealSection";

interface Testimonial {
  name: string;
  text: string;
  rating: number;
}

const TestimonialsSection = ({ testimonials }: { testimonials: Testimonial[] }) => {
  const { t } = useLang();

  return (
    <section className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-secondary/20 relative overflow-hidden">
      <div className="absolute bottom-0 end-1/4 w-[300px] h-[300px] bg-primary/3 rounded-full blur-[120px]" />
      <div className="max-w-5xl mx-auto relative z-10">
        <RevealSection>
          <div className="text-center mb-12 sm:mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-primary text-xs font-semibold tracking-wide mb-4">
              ⭐ {t("testimonialsTitle")}
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-foreground mb-3 tracking-tight">{t("testimonialsTitle")}</h2>
            <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">{t("testimonialsSubtitle")}</p>
          </div>
        </RevealSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
          {testimonials.map((review, i) => (
            <RevealSection key={i} delay={i * 100}>
              <div className="bg-card rounded-2xl border border-border p-6 sm:p-7 hover:shadow-premium hover:border-primary/15 hover:-translate-y-1 transition-all duration-300 h-full flex flex-col relative overflow-hidden group">
                <div className="absolute top-4 end-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Quote className="h-12 w-12 text-primary" />
                </div>
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: review.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed mb-6 flex-1 italic">"{review.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary text-white text-sm font-bold shadow-glow">
                    {review.name.charAt(0)}
                  </span>
                  <div>
                    <span className="text-sm font-semibold text-foreground block">{review.name}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                      {t("verifiedClient")}
                    </span>
                  </div>
                </div>
              </div>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;