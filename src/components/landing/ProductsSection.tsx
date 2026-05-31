import { useLang } from "@/store/LangContext";
import { Link } from "react-router-dom";
import { ArrowRight, Flame, Crown, Package } from "lucide-react";
import type { ApiService } from "@/utils/api";
import RevealSection from "./RevealSection";

const ProductsSection = ({ services, loading }: { services: ApiService[]; loading?: boolean }) => {
  const { t } = useLang();

  const getBadge = (index: number) => {
    if (index === 0) return { label: t("popular") || "Populaire", icon: Flame, color: "bg-destructive text-destructive-foreground" };
    if (index === 1) return { label: t("bestValue") || "Meilleur choix", icon: Crown, color: "gradient-primary text-primary-foreground" };
    return null;
  };

  return (
    <section id="products" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <RevealSection>
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">{t("products")}</p>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground mb-3 tracking-tight">{t("servicesTitle")}</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">{t("servicesCatalogSubtitle")}</p>
          </div>
        </RevealSection>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-secondary" />
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="h-4 bg-secondary rounded w-3/4" />
                  <div className="h-3 bg-secondary rounded w-full" />
                  <div className="h-3 bg-secondary rounded w-1/2" />
                  <div className="flex items-center justify-between mt-4">
                    <div className="h-6 bg-secondary rounded w-16" />
                    <div className="h-9 bg-secondary rounded-xl w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <Package className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <p className="text-muted-foreground font-medium">{t("noServices")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {services.map((s, i) => {
              const badge = getBadge(i);
              return (
                <RevealSection key={s.id} delay={i * 80}>
                  <Link
                    to={`/service/${s.id}`}
                    className="group relative block bg-card rounded-2xl border border-border overflow-hidden hover:shadow-premium hover:border-primary/20 transition-all duration-300"
                  >
                    {badge && (
                      <div className={`absolute top-3 start-3 z-10 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold shadow-sm ${badge.color}`}>
                        <badge.icon className="h-3 w-3" />
                        {badge.label}
                      </div>
                    )}
                    <div className="relative aspect-[4/3] bg-secondary overflow-hidden">
                      <img
                        src={s.image_url}
                        alt={s.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-foreground/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <div className="p-4 sm:p-5">
                      <h3 className="font-display font-semibold text-foreground text-sm leading-snug line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">{s.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{s.description}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xl font-display font-bold text-foreground">{Number(s.price_credits)}</span>
                          <span className="text-[10px] font-medium text-muted-foreground ms-1 uppercase">TND</span>
                        </div>
                        <span className="inline-flex items-center gap-1 h-9 px-4 text-xs font-semibold rounded-xl gradient-primary text-primary-foreground shadow-sm group-hover:shadow-glow transition-all duration-200">
                          {t("addToCart")}
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </RevealSection>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductsSection;
