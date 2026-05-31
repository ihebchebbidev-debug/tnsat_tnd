import { useState } from "react";
import { useLang } from "@/store/LangContext";
import { apiSendContactMessage } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MapPin, Send, Clock, MessageSquare, Headphones } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const RevealSection = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const { ref, isVisible } = useScrollReveal(0.1);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(24px)",
      }}
    >
      {children}
    </div>
  );
};

const Contact = () => {
  const { t } = useLang();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setSending(true);
    try {
      await apiSendContactMessage({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      toast({ title: t("success"), description: t("contactSuccess") });
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message || "Failed to send message", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const contactInfo = [
    { icon: Mail, label: t("email"), value: "mail@tnsat.tn", href: "mailto:mail@tnsat.tn" },
    { icon: Phone, label: t("contactPhone"), value: "+216 53 349 001", href: "tel:+21653349001" },
    { icon: MapPin, label: t("contactAddress"), value: "Tunisie", href: undefined },
    { icon: Clock, label: t("contactHours"), value: t("contactHoursValue"), href: undefined },
  ];

  const features = [
    { icon: MessageSquare, title: t("contactFeature1Title"), desc: t("contactFeature1Desc") },
    { icon: Headphones, title: t("contactFeature2Title"), desc: t("contactFeature2Desc") },
    { icon: Clock, title: t("contactFeature3Title"), desc: t("contactFeature3Desc") },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative py-20 md:py-28 overflow-hidden" style={{ background: "hsl(228, 35%, 8%)" }}>
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <RevealSection>
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/15 border border-primary/25 mb-6">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
              </span>
              <span className="text-accent text-xs font-semibold uppercase tracking-wider">{t("contactBadge")}</span>
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-primary-foreground leading-tight mb-4">
              {t("contactTitle")}
            </h1>
            <p className="text-base md:text-lg text-primary-foreground/50 max-w-lg mx-auto">
              {t("contactSubtitle")}
            </p>
          </RevealSection>
        </div>
      </section>

      {/* Features bar */}
      <section className="relative -mt-8 z-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden shadow-premium">
            {features.map((f, i) => (
              <RevealSection key={i} delay={i * 80} className="flex items-center gap-3 bg-card px-6 py-5">
                <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/5 flex-shrink-0">
                  <f.icon className="h-5 w-5 text-primary" />
                </span>
                <div>
                  <p className="text-sm font-display font-semibold text-foreground">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-12">
            {/* Contact form */}
            <RevealSection className="lg:col-span-3">
              <div className="bg-card rounded-2xl border border-border shadow-premium p-8">
                <h2 className="text-xl font-display font-bold text-foreground mb-1">{t("contactFormTitle")}</h2>
                <p className="text-sm text-muted-foreground mb-8">{t("contactFormSubtitle")}</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t("name")}</label>
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder={t("contactNamePlaceholder")}
                        className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t("email")}</label>
                      <input
                        type="email"
                        required
                        maxLength={255}
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="email@example.com"
                        className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">{t("contactSubjectLabel")}</label>
                    <input
                      type="text"
                      maxLength={200}
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      placeholder={t("contactSubjectPlaceholder")}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">{t("contactMessageLabel")}</label>
                    <textarea
                      required
                      maxLength={2000}
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder={t("contactMessagePlaceholder")}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex items-center gap-2 h-11 px-8 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm shadow-glow hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-60"
                  >
                    {sending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        {t("contactSending")}
                      </span>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        {t("contactSend")}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </RevealSection>

            {/* Contact info sidebar */}
            <RevealSection delay={200} className="lg:col-span-2">
              <div className="space-y-6">
                <div className="bg-card rounded-2xl border border-border shadow-premium p-8">
                  <h3 className="text-lg font-display font-bold text-foreground mb-6">{t("contactInfoTitle")}</h3>
                  <div className="space-y-5">
                    {contactInfo.map((info, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/5 flex-shrink-0">
                          <info.icon className="h-4 w-4 text-primary" />
                        </span>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">{info.label}</p>
                          {info.href ? (
                            <a href={info.href} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                              {info.value}
                            </a>
                          ) : (
                            <p className="text-sm font-medium text-foreground">{info.value}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FAQ teaser */}
                <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl border border-primary/10 p-8">
                  <h3 className="text-lg font-display font-bold text-foreground mb-2">{t("contactFaqTitle")}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{t("contactFaqDesc")}</p>
                  <div className="space-y-3">
                    {[t("contactFaq1"), t("contactFaq2"), t("contactFaq3")].map((q, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-foreground/70">
                        <span className="text-primary font-bold mt-0.5">Q:</span>
                        <span>{q}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
