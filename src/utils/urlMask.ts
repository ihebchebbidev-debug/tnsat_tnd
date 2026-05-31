/**
 * Display-only URL masking.
 *
 * Visually replaces the real backend host (luccibyey.com.tn) with tnsat.net
 * in any text shown to users (e.g. URL input fields, copied URLs).
 *
 * IMPORTANT: This is a UI-only transformation. Actual API calls and <img src>
 * attributes must keep using the real host so images and requests still work.
 *
 * Always pair `maskUrl` (display) with `unmaskUrl` (before save / API send).
 */

const REAL_HOST = "luccibyey.com.tn";
const DISPLAY_HOST = "tnsat.net";

export const maskUrl = (value: string | null | undefined): string => {
  if (!value) return "";
  return value.split(REAL_HOST).join(DISPLAY_HOST);
};

export const unmaskUrl = (value: string | null | undefined): string => {
  if (!value) return "";
  return value.split(DISPLAY_HOST).join(REAL_HOST);
};
