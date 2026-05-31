import { useLang } from "@/store/LangContext";
import { Link, useLocation } from "react-router-dom";
import { getAuth, setAuth } from "@/store/store";
import { Menu, X, User, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import tnsatLogo from "@/assets/tnsat-logo.png";
import { FlagFR, FlagEN, FlagAR } from "@/components/Flags";
import type { Lang } from "@/utils/translations";

const langOptions: { code: Lang; label: string; Flag: React.FC<{ className?: string }> }[] = [
  { code: "fr", label: "FR", Flag: FlagFR },
  { code: "en", label: "EN", Flag: FlagEN },
  { code: "ar", label: "AR", Flag: FlagAR },
];

const Navbar = () => {
  const { t, lang, setLanguage } = useLang();
  const auth = getAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [langDropdown, setLangDropdown] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangDropdown(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = () => {
    setAuth(null);
    window.location.href = "/";
  };

  const isActive = (path: string) => location.pathname === path;
  const currentLang = langOptions.find((l) => l.code === lang) || langOptions[0];

  const navLinks: { to: string; label: string; isLink: boolean }[] = [];

  return (
    <header className="sticky top-0 z-50">
      <nav
        className={`transition-all duration-300 border-b ${
          scrolled
            ? "bg-background/95 backdrop-blur-xl shadow-sm border-border"
            : "bg-background border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 sm:h-[72px] flex items-center justify-between relative">
            {/* Logo */}
            <Link to="/" className="flex-shrink-0 flex items-center gap-3 group">
              <img
                src={tnsatLogo}
                alt="Logo"
                className="h-14 sm:h-16 md:h-20 w-auto transition-transform group-hover:scale-105"
              />
            </Link>

            {/* Desktop nav links */}
            <div className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
              {navLinks.map((link) =>
                link.isLink ? (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive(link.to)
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {link.label}
                    {isActive(link.to) && (
                      <span className="absolute bottom-0 left-4 right-4 h-0.5 gradient-primary rounded-full" />
                    )}
                  </Link>
                ) : (
                  <a
                    key={link.to}
                    href={link.to}
                    onClick={(e) => {
                      if (location.pathname !== "/") {
                        e.preventDefault();
                        window.location.href = link.to;
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all duration-200"
                  >
                    {link.label}
                  </a>
                )
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Language dropdown */}
              <div className="relative" ref={langRef}>
                <button
                  onClick={() => setLangDropdown(!langDropdown)}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all"
                >
                  <currentLang.Flag className="h-3.5 w-5 rounded-sm overflow-hidden" />
                  <span className="hidden sm:inline">{currentLang.label}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${langDropdown ? "rotate-180" : ""}`} />
                </button>
                {langDropdown && (
                  <div className="absolute top-full mt-1 end-0 bg-card border border-border rounded-xl shadow-premium py-1 min-w-[120px] z-50">
                    {langOptions.map((opt) => (
                      <button
                        key={opt.code}
                        onClick={() => { setLanguage(opt.code); setLangDropdown(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                          lang === opt.code ? "text-primary bg-primary/5 font-medium" : "text-foreground hover:bg-secondary"
                        }`}
                      >
                        <opt.Flag className="h-3.5 w-5 rounded-sm overflow-hidden" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {auth ? (
                <div className="hidden lg:flex items-center gap-1">
                  <Link
                    to={auth.type === "admin" ? "/admin" : auth.type === "reseller" ? "/reseller" : "/client"}
                    className="flex items-center gap-2 h-10 px-4 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {t("dashboard")}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 h-10 px-4 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-all"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("logout")}
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="hidden lg:inline-flex items-center gap-2 h-10 px-6 text-sm font-semibold rounded-xl gradient-primary text-primary-foreground shadow-glow hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  <User className="h-4 w-4" />
                  {t("login")}
                </Link>
              )}

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        <div className={`lg:hidden overflow-hidden transition-all duration-300 ${mobileOpen ? "max-h-[400px] border-t border-border" : "max-h-0"}`}>
          <div className="bg-background px-4 py-3 space-y-0.5">
            {navLinks.map((link) =>
              link.isLink ? (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center px-4 py-3 text-sm rounded-xl transition-all ${
                    isActive(link.to) ? "text-primary font-medium bg-primary/5" : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.to}
                  href={link.to}
                  className="flex items-center px-4 py-3 text-sm text-muted-foreground hover:bg-secondary rounded-xl transition-all"
                >
                  {link.label}
                </a>
              )
            )}
            <div className="pt-2 mt-2 border-t border-border">
              {auth ? (
                <>
                  <Link
                    to={auth.type === "admin" ? "/admin" : auth.type === "reseller" ? "/reseller" : "/client"}
                    className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:bg-secondary rounded-xl"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {t("dashboard")}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("logout")}
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl gradient-primary text-primary-foreground shadow-glow"
                >
                  <User className="h-4 w-4" />
                  {t("login")}
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
