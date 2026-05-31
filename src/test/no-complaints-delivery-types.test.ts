import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * UI regression: confirms that "Réclamations" (complaints) and
 * "Types de livraison" (delivery types) have been fully removed from
 * the Admin and Reseller dashboard UIs.
 *
 * Run with:  npx vitest run src/test/no-complaints-delivery-types.test.ts
 */

const ADMIN = resolve(__dirname, "../pages/AdminDashboard.tsx");
const RESELLER = resolve(__dirname, "../pages/ResellerDashboard.tsx");

const adminSrc = readFileSync(ADMIN, "utf8");
const resellerSrc = readFileSync(RESELLER, "utf8");

// Patterns that would indicate UI presence (menu items, tab content blocks,
// dialogs, doc sections, stat cards, toolbar buttons, etc.).
const uiPatterns: { label: string; pattern: RegExp }[] = [
  { label: 'tab === "complaints"', pattern: /tab\s*===\s*["']complaints["']/ },
  { label: 'tab === "deliveryTypes"', pattern: /tab\s*===\s*["']deliveryTypes["']/ },
  { label: 'menu key "complaints"', pattern: /key:\s*["']complaints["']/ },
  { label: 'menu key "deliveryTypes"', pattern: /key:\s*["']deliveryTypes["']/ },
  { label: 't("complaints") label', pattern: /t\(\s*["']complaints["']\s*\)/ },
  { label: 't("deliveryTypes") label', pattern: /t\(\s*["']deliveryTypes["']\s*\)/ },
  { label: 't("openComplaints") label', pattern: /t\(\s*["']openComplaints["']\s*\)/ },
  { label: 't("handleComplaint") label', pattern: /t\(\s*["']handleComplaint["']\s*\)/ },
  { label: "Réclamations literal", pattern: /Réclamations/ },
  { label: "Types de livraison literal", pattern: /Types de livraison/ },
  { label: "handlingComplaint state", pattern: /handlingComplaint/ },
  { label: "openHandleComplaint handler", pattern: /openHandleComplaint/ },
  { label: "DocSection complaints id", pattern: /id=["']complaints["']/ },
  { label: "DocSection delivery-types id", pattern: /id=["']delivery-types["']/ },
];

describe("UI regression: Réclamations & Types de livraison removed", () => {
  describe("AdminDashboard.tsx", () => {
    for (const { label, pattern } of uiPatterns) {
      it(`does not contain UI: ${label}`, () => {
        expect(adminSrc).not.toMatch(pattern);
      });
    }
  });

  describe("ResellerDashboard.tsx", () => {
    for (const { label, pattern } of uiPatterns) {
      it(`does not contain UI: ${label}`, () => {
        expect(resellerSrc).not.toMatch(pattern);
      });
    }
  });
});
