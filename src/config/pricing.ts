export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string;
  tagline: string;
  clientLimit: number | null; // null = unlimited
  features: string[];
  highlighted: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    currency: "€",
    period: "month",
    tagline: "For sole practitioners getting started.",
    clientLimit: 10,
    features: [
      "10 client limit",
      "All filing types (CT1, Form 11, VAT3, CRO)",
      "Unlimited filings per client",
      "CSV / Xero / Sage import",
      "ROS XML generation",
      "CRO PDF generation",
      "Client portal & e-signatures",
      "Email support",
    ],
    highlighted: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: 79,
    currency: "€",
    period: "month",
    tagline: "For growing practices. Most popular.",
    clientLimit: 50,
    features: [
      "50 client limit",
      "Everything in Starter, plus:",
      "TAIN auto-sync (pull all client data from ROS)",
      "Daily data refresh (6AM cron)",
      "Team access (invite staff)",
      "Bulk filing workflows",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    id: "practice",
    name: "Practice",
    price: 149,
    currency: "€",
    period: "month",
    tagline: "For established practices at scale.",
    clientLimit: null,
    features: [
      "Unlimited clients",
      "Everything in Growth, plus:",
      "Dedicated onboarding",
      "API access",
      "Custom filing templates",
      "Audit trail & compliance reporting",
      "Same-day support",
    ],
    highlighted: false,
  },
];

export const getPlanById = (id: string): PricingPlan | undefined => {
  return PRICING_PLANS.find((plan) => plan.id === id);
};

export const getHighlightedPlan = (): PricingPlan | undefined => {
  return PRICING_PLANS.find((plan) => plan.highlighted);
};

export const formatPrice = (plan: PricingPlan): string => {
  return `${plan.currency}${plan.price}/${plan.period}`;
};

export const getClientLimitDisplay = (plan: PricingPlan): string => {
  if (plan.clientLimit === null) return "Unlimited clients";
  return `Up to ${plan.clientLimit} clients`;
};
