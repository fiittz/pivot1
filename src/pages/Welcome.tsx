import { useState, useEffect } from "react";
import { Check } from "lucide-react";

const ROTATING_WORDS = ["business", "team", "clients"];

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    clients: "Up to 10 clients",
    description: "For sole practitioners getting started.",
    features: [
      "Up to 10 clients",
      "Unlimited team members",
      "Unlimited filings per client",
      "All filing types (CT1, Form 11, VAT3, CRO)",
      "CSV / Xero / Sage import",
      "ROS & CRO report generation",
      "Client portal & e-signatures",
      "Email support",
    ],
    highlighted: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: 79,
    clients: "Up to 50 clients",
    description: "For growing practices. Most popular.",
    features: [
      "Up to 50 clients",
      "Unlimited team members",
      "Everything in Starter, plus:",
      "TAIN auto-sync from ROS",
      "Daily data refresh",
      "Bulk filing workflows",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    id: "practice",
    name: "Practice",
    price: 149,
    clients: "Unlimited clients",
    description: "For established practices at scale.",
    features: [
      "Unlimited clients",
      "Unlimited team members",
      "Everything in Growth, plus:",
      "Dedicated onboarding",
      "Custom filing templates",
      "Audit trail & compliance reporting",
      "Same-day support",
    ],
    highlighted: false,
  },
];

const Welcome = () => {
  const [wordIndex, setWordIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setWordIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
        setIsAnimating(false);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const scrollToPricing = () => {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-2">
          <img
            src="/enhance-penguin-transparent.png"
            alt="Balnce"
            className="w-8 h-8 object-contain"
          />
          <div className="inline-flex gap-[0.04em] items-center">
            {"BALNCE".split("").map((char, i) => (
              <div
                key={i}
                className="relative overflow-hidden flex items-center justify-center"
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "1.4rem",
                  width: "0.65em",
                  height: "1.05em",
                  backgroundColor: "#000",
                  color: "#fff",
                }}
              >
                {char}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={scrollToPricing}
            className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-black/60 hover:text-black transition-colors"
          >
            Pricing
          </button>
          <a
            href="/demo"
            className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-black/60 hover:text-black transition-colors"
          >
            Book a Demo
          </a>
          <a
            href="https://app.balnce.ie"
            className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest border border-black px-5 py-2.5 text-black hover:bg-black hover:text-white transition-colors"
          >
            Sign In
          </a>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <div className="max-w-4xl text-center">
          <h1
            className="font-['IBM_Plex_Sans'] font-bold tracking-tight leading-[1.1] mb-6"
            style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)" }}
          >
            <span className="text-black">Your </span>
            <span
              className={`inline-block transition-all duration-300 ${
                isAnimating
                  ? "opacity-0 translate-y-2"
                  : "opacity-100 translate-y-0"
              }`}
              style={{ color: "#E8930C", minWidth: "3ch" }}
            >
              {ROTATING_WORDS[wordIndex]}
            </span>
            <span className="text-black"> deserve</span>
            <br />
            <span className="text-black">better tools.</span>
          </h1>

          <p className="font-['IBM_Plex_Sans'] text-black/50 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect your TAIN cert, pull client data from ROS automatically, build your
            working papers, generate XML &amp; PDF — and file. All from one platform
            built for Irish accountants.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={scrollToPricing}
              className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest border-2 border-[#E8930C] bg-[#E8930C] px-8 py-4 text-white hover:bg-[#E8930C]/90 transition-colors"
            >
              Get Started
            </button>
            <a
              href="/demo"
              className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest border border-black/20 px-8 py-4 text-black hover:bg-black/5 transition-colors"
            >
              Book a Demo
            </a>
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="px-6 md:px-12 py-24 border-t border-black/10">
        <div className="max-w-5xl mx-auto">
          <p className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] mb-4">
            03 / Features
          </p>
          <h2 className="font-['IBM_Plex_Sans'] font-bold text-black text-3xl md:text-4xl mb-16">
            Built for accounting practices.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {[
              {
                num: "01",
                tag: "CLIENTS",
                title: "CLIENT MANAGEMENT",
                desc: "All your clients in one dashboard. See filing status at a glance — what's drafted, what's awaiting signature, what's overdue. No more digging through folders.",
              },
              {
                num: "02",
                tag: "FILING",
                title: "EVERY IRISH FILING TYPE",
                desc: "CT1, Form 11, VAT3, RCT, CRO B1, Abridged Accounts — 20+ filing types covered. One platform for everything Revenue and the CRO need from you.",
              },
              {
                num: "03",
                tag: "TEAM",
                title: "TEAM ACCESS",
                desc: "Partners, managers, accountants, bookkeepers — everyone gets the right level of access. Only senior roles can finalise and file. Every change is tracked.",
              },
              {
                num: "04",
                tag: "IMPORT",
                title: "TRIAL BALANCE IMPORT",
                desc: "Drag and drop from Xero, Sage, QuickBooks, or CSV. Accounts auto-map to the right CT1 or Form 11 sections based on the filing type.",
              },
              {
                num: "05",
                tag: "PORTAL",
                title: "CLIENT PORTAL",
                desc: "Your client reviews the summary, signs on screen, and you file. No printing, no scanning, no chasing. E-signatures built in.",
              },
              {
                num: "06",
                tag: "AUDIT",
                title: "AUDIT TRAIL",
                desc: "Every change to every figure is tracked. Who changed it, when, and why. Full compliance reporting when you need it.",
              },
            ].map((feature, i) => (
              <div
                key={feature.num}
                className={`p-8 md:p-10 border-b border-black/10 ${
                  i % 2 === 0 ? "md:border-r" : ""
                }`}
              >
                <p className="font-['IBM_Plex_Mono'] text-[11px] uppercase tracking-widest text-black/30 mb-3">
                  {feature.num} / {feature.tag}
                </p>
                <h3 className="font-['IBM_Plex_Sans'] font-bold text-black text-lg mb-3">
                  {feature.title}
                </h3>
                <p className="font-['IBM_Plex_Sans'] text-black/50 text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 md:px-12 py-24 border-t border-black/10 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-['IBM_Plex_Sans'] font-bold text-black text-3xl md:text-4xl mb-16">
            How it works.
          </h2>

          <div className="space-y-10">
            <div>
              <h3 className="font-['IBM_Plex_Sans'] font-semibold text-black text-lg mb-2">
                01 — Connect & invite your team
              </h3>
              <p className="font-['IBM_Plex_Sans'] text-black/50 text-sm leading-relaxed pl-10">
                Upload your TAIN cert. Invite your team and assign roles.
              </p>
            </div>

            <div>
              <h3 className="font-['IBM_Plex_Sans'] font-semibold text-black text-lg mb-2">
                02 — Work the filing
              </h3>
              <p className="font-['IBM_Plex_Sans'] text-black/50 text-sm leading-relaxed pl-10">
                Import a trial balance. Build working papers, track every change.
              </p>
            </div>

            <div>
              <h3 className="font-['IBM_Plex_Sans'] font-semibold text-black text-lg mb-2">
                03 — File
              </h3>
              <p className="font-['IBM_Plex_Sans'] text-black/50 text-sm leading-relaxed pl-10">
                Generate ROS or CRO reports. Client signs in the portal. File to Revenue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 md:px-12 py-24 border-t border-black/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-['IBM_Plex_Sans'] font-bold text-black text-3xl md:text-4xl mb-4">
              Simple pricing. No per-filing fees.
            </h2>
            <p className="font-['IBM_Plex_Sans'] text-black/50 text-lg max-w-2xl mx-auto">
              Pick a plan based on how many clients you manage. Every plan includes
              unlimited filings — CT1, Form 11, VAT3, CRO, the lot.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col p-8 ${
                  plan.highlighted
                    ? "border-2 border-[#E8930C] bg-white shadow-lg"
                    : "border border-black/10 bg-white"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="font-['IBM_Plex_Mono'] text-[10px] uppercase tracking-widest bg-[#E8930C] text-white px-4 py-1">
                      Most Popular
                    </span>
                  </div>
                )}

                <h3 className="font-['IBM_Plex_Sans'] font-bold text-black text-xl mb-1">
                  {plan.name}
                </h3>
                <p className="font-['IBM_Plex_Sans'] text-black/50 text-sm mb-6">
                  {plan.description}
                </p>

                <div className="mb-6">
                  <span className="font-['IBM_Plex_Sans'] font-bold text-4xl text-black">
                    €{plan.price}
                  </span>
                  <span className="font-['IBM_Plex_Sans'] text-black/40 text-sm">
                    /month
                  </span>
                </div>

                <p className="font-['IBM_Plex_Mono'] text-xs text-[#E8930C] font-bold uppercase tracking-wider mb-6">
                  {plan.clients}
                </p>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#E8930C] mt-0.5 flex-shrink-0" />
                      <span className="font-['IBM_Plex_Sans'] text-black/60 text-sm">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <a
                  href={`https://app.balnce.ie?plan=${plan.id}`}
                  className={`block text-center font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest px-6 py-4 transition-colors ${
                    plan.highlighted
                      ? "border-2 border-[#E8930C] bg-[#E8930C] text-white hover:bg-[#E8930C]/90"
                      : "border border-black/20 text-black hover:bg-black hover:text-white"
                  }`}
                >
                  Get Started
                </a>
              </div>
            ))}
          </div>

          <p className="text-center font-['IBM_Plex_Sans'] text-black/30 text-sm mt-8">
            All prices exclude VAT. Cancel anytime. 14-day free trial on all plans.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 md:px-12 py-24 border-t border-black/10 bg-black">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] mb-6">
            Ready to automate?
          </p>
          <h2 className="font-['IBM_Plex_Sans'] font-bold text-white text-3xl md:text-5xl leading-tight mb-6">
            Generate & file tax reports<br />in minutes.
          </h2>
          <p className="font-['IBM_Plex_Sans'] text-white/50 text-lg mb-10">
            Create your account and start filing today.
          </p>
          <a
            href="https://app.balnce.ie"
            className="inline-block font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest border-2 border-[#E8930C] bg-[#E8930C] px-10 py-4 text-white hover:bg-[#E8930C]/90 transition-colors"
          >
            Create Account
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 px-6 flex items-center justify-between border-t border-black/10">
        <span className="text-black/30 font-['IBM_Plex_Sans'] text-xs">
          Balnce {new Date().getFullYear()}
        </span>
        <a
          href="/privacy"
          className="text-black/30 hover:text-black/60 font-['IBM_Plex_Sans'] text-xs transition-colors"
        >
          Privacy Policy
        </a>
      </footer>
    </div>
  );
};

export default Welcome;
