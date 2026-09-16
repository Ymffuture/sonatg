// Sona Purple pricing (South African Rand).
export const PRICING = {
  currency: "R",
  monthly: { amount: 28.99, label: "R28.99", per: "/month" },
  yearly: {
    amount: 227.88,
    label: "R227.88",
    per: "/year",
    perMonthLabel: "R18.99",
    savePercent: 66,
  },
} as const;

export type BillingInterval = "monthly" | "yearly";

// Sona Business verification pricing (South African Rand). Kept as its own
// constant, not a variant of PRICING, since the two plans change
// independently — see paypal.functions.ts (PAYPAL_PRICE_BUSINESS_MONTHLY /
// PAYPAL_PRICE_BUSINESS_YEARLY are separate env vars from the Purple ones).
export const BUSINESS_PRICING = {
  currency: "R",
  monthly: { amount: 179.99, label: "R179.99", per: "/month" },
  yearly: {
    amount: 1619.88,
    label: "R1,619.88",
    per: "/year",
    perMonthLabel: "R134.99",
    savePercent: 25,
  },
} as const;
