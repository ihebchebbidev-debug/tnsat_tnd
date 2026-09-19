import { useLang } from "@/store/LangContext";
import { Link, useParams } from "react-router-dom";
import { apiGetServices, type ApiService } from "@/utils/api";
import { useState, useEffect } from "react";
import { ArrowLeft, ShoppingCart, CheckCircle, Zap } from "lucide-react";
import Seo from "@/components/Seo";

const ServiceDetail = () => {
  const { t } = useLang();
  const { id } = useParams<{ id: string }>();
  const [service, setService] = useState<ApiService | null>(null);
  const [allServices, setAllServices] = useState<ApiService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetServices()
      .then((data) => {
        setAllServices(data);
        setService(data.find((s) => s.id === id) || null);
      })
      .catch(() => {
        setAllServices([]);
        setService(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-display font-bold text-foreground mb-2">{t("serviceNotFound")}</h2>
          <Link to="/" className="text-primary text-sm hover:underline">{t("backToHome")}</Link>
        </div>
      </div>
    );
  }

  const otherServices = allServices.filter((s) => s.id !== service.id).slice(0, 3);

  const hasSpecs = service.specifications && Object.keys(service.specifications).length > 0;
  const hasFeatures = service.features && service.features.length > 0;

  const serviceSchema = service ? {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": service.name,
    "description": service.description,
    "image": service.image_url,
    "offers": {
      "@type": "Offer",
      "price": service.price_credits,
      "priceCurrency": "XTS",
      "availability": service.stock === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock"
    }
  } : null;

  return (
    <div>
      <Seo 
        title={service.name}
        description={service.description}
        type="product"
        image={service.image_url}
        schema={serviceSchema}
      />
      <div className="bg-secondary/50 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {t("home")} / {t("products")}
          </Link>
        </div>
      </div>

      <section className="py-12 md:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-secondary border border-border">
              <img
                src={service.image_url}
                alt={service.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex flex-col justify-center">
              <span className="inline-block text-primary text-xs font-semibold uppercase tracking-widest mb-3">IPTV Premium</span>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-4">{service.name}</h1>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">{service.description}</p>

              {/* Specifications */}
              {hasSpecs && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("specifications")}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(service.specifications!).map(([key, value]) => (
                      <div key={key} className="bg-secondary/40 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-muted-foreground uppercase">{key}</p>
                        <p className="text-sm font-semibold text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Features */}
              {hasFeatures && (
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {service.features!.map((feat, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-foreground/70">
                      <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                      {feat}
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-secondary/60 rounded-xl p-6 border border-border mb-6">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-display font-bold text-foreground">{Number(service.price_credits)}</span>
                  <span className="text-sm font-medium text-muted-foreground">Crédits</span>
                </div>
              </div>

              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2.5 h-12 px-8 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                <ShoppingCart className="h-4 w-4" />
                {t("addToCart")}
              </Link>

              <div className="flex flex-wrap gap-4 mt-6">
                {[t("heroFeature1"), t("heroFeature2"), t("heroFeature3")].map((f, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-success" />
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {otherServices.length > 0 && (
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-secondary/30 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xl font-display font-bold text-foreground mb-8">{t("otherSubscriptions")}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherServices.map((s) => (
                <Link
                  key={s.id}
                  to={`/service/${s.id}`}
                  className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-premium hover:border-primary/20 transition-all duration-300"
                >
                  <div className="aspect-[4/3] bg-secondary overflow-hidden">
                    <img src={s.image_url} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  </div>
                  <div className="p-5">
                    <h3 className="font-display font-semibold text-foreground text-sm leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">{s.name}</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-display font-bold text-foreground">{Number(s.price_credits)}</span>
                        <span className="text-xs text-muted-foreground ml-1">Crédits</span>
                      </div>
                      <span className="text-xs font-medium text-primary">{t("viewService")}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default ServiceDetail;