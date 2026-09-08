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
