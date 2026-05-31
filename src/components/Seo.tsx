import { useEffect } from "react";

interface SeoProps {
  title?: string;
  description?: string;
  canonical?: string;
  type?: "website" | "article" | "product";
  image?: string;
  schema?: any;
}

const Seo = ({
  title,
  description,
  canonical = "https://tnsat.tn",
  type = "website",
  image = "/og-image.png",
  schema,
}: SeoProps) => {
  const siteTitle = "TNSAT - IPTV Premium Tunisie";
  const fullTitle = title ? `${title} | ${siteTitle}` : siteTitle;

  useEffect(() => {
    document.title = fullTitle;

    const setMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    if (description) setMeta("description", description);
    setMeta("og:type", type, true);
    setMeta("og:title", fullTitle, true);
    if (description) setMeta("og:description", description, true);
    setMeta("og:image", image, true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    if (description) setMeta("twitter:description", description);
    setMeta("twitter:image", image);

    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", title ? `${canonical}${window.location.pathname}` : canonical);

    // Structured data
    const existingScript = document.querySelector('script[data-seo-schema]');
    if (existingScript) existingScript.remove();
    if (schema) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-seo-schema", "true");
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }
  }, [fullTitle, description, canonical, type, image, schema, title]);

  return null;
};

export default Seo;
