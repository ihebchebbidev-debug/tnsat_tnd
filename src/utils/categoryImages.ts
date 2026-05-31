import catIptvActiveCode from "@/assets/category-iptv-active-code.png";
import catXtreamIptv from "@/assets/category-xtream-iptv.png";
import catTestIptv from "@/assets/category-test-iptv.png";
import catNetflix from "@/assets/category-netflix.png";
import catIboplayer from "@/assets/category-iboplayer.png";

/**
 * Default fallback images for known categories.
 * Used when category.image_url is empty.
 */
export const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  "IPTV ACTIVE CODE": catIptvActiveCode,
  "ACTIVE CODE IPTV": catIptvActiveCode,
  "XTREAM IPTV": catXtreamIptv,
  "XTREAM CODE M3U": catXtreamIptv,
  "IPTV XTREAM M3U": catXtreamIptv,
  "TEST-IPTV": catTestIptv,
  "TEST IPTV": catTestIptv,
  "NETFLIX": catNetflix,
  "IBOPLAYER": catIboplayer,
  "APPLICATIONS SMART TV": catIboplayer,
  "APPLICATIONS SMART": catIboplayer,
  "APPLICATION SMART TV": catIboplayer,
  "APPLICATION SMART": catIboplayer,
};

export function getCategoryImage(name: string, imageUrl?: string): string {
  if (imageUrl) return imageUrl;
  // Try exact match first, then uppercase
  return DEFAULT_CATEGORY_IMAGES[name] || DEFAULT_CATEGORY_IMAGES[name.toUpperCase()] || "";
}
