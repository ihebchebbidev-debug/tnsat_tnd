import { useLang } from "@/store/LangContext";

const Footer = () => {
  const { t } = useLang();

  return (
    <footer className="border-t border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} TNSAT. {t("footerRights")}
        </p>
        <span className="text-xs text-muted-foreground">
          Developed by{" "}
          <a href="https://ihebchebbi.pro/" target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-primary transition-colors">
            Iheb Chebbi
          </a>
        </span>
      </div>
    </footer>
  );
};

export default Footer;
