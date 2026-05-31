import { MessageCircle } from "lucide-react";

const WhatsAppButton = () => {
  const phone = "21653349001";
  const message = encodeURIComponent("Bonjour, j'ai besoin d'aide !");
  const url = `https://wa.me/${phone}?text=${message}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contacter sur WhatsApp"
      className="fixed bottom-5 end-5 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all duration-300 group md:bottom-6 md:end-6"
      style={{ background: "#25D366" }}
    >
      <svg viewBox="0 0 32 32" className="w-7 h-7 text-white fill-current">
        <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.5 1.128 6.744 3.046 9.378L1.054 31.2l6.044-1.94a15.9 15.9 0 008.906 2.744C24.828 32.004 32 24.828 32 16.004S24.828 0 16.004 0zm9.35 22.616c-.396 1.116-2.316 2.076-3.234 2.148-.862.068-1.674.388-5.634-1.172-4.776-1.88-7.794-6.79-8.032-7.106-.228-.318-1.888-2.51-1.888-4.786s1.194-3.396 1.618-3.862c.424-.466.924-.582 1.232-.582.308 0 .616.002.886.016.284.014.666-.108.942.718.318.826 1.076 2.872 1.172 3.08.094.208.158.45.032.726-.128.276-.19.45-.378.694-.19.244-.398.544-.568.73-.19.208-.388.434-.166.852.22.418.98 1.618 2.106 2.622 1.448 1.29 2.668 1.69 3.046 1.878.378.19.598.158.818-.096.22-.254.942-1.098 1.194-1.476.252-.378.504-.316.848-.19.344.128 2.184 1.03 2.558 1.218.378.19.628.284.722.44.094.158.094.904-.302 2.02z" />
      </svg>
      <span className="absolute bottom-full end-0 mb-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200" style={{ background: "#25D366" }}>
        WhatsApp
      </span>
    </a>
  );
};

export default WhatsAppButton;
