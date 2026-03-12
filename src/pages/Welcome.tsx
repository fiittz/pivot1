import { useState, useEffect } from "react";

const ROTATING_WORDS = ["business", "team", "clients"];

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
            Launch App
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
            Irish tax filing, simplified. ROS returns, CRO filings, and practice
            management — all in one platform built for Irish accountants.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://app.balnce.ie"
              className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest border-2 border-[#E8930C] bg-[#E8930C] px-8 py-4 text-white hover:bg-[#E8930C]/90 transition-colors"
            >
              Get Started
            </a>
            <a
              href="/demo"
              className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest border border-black/20 px-8 py-4 text-black hover:bg-black/5 transition-colors"
            >
              Book a Demo
            </a>
          </div>
        </div>
      </div>

      {/* Who it's for */}
      <section className="px-6 md:px-12 py-24 border-t border-black/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-['IBM_Plex_Sans'] font-bold text-black text-3xl md:text-4xl mb-4">
            Built for accounting practices.
          </h2>
          <p className="font-['IBM_Plex_Sans'] text-black/50 text-lg mb-16 max-w-2xl">
            Managing dozens of clients across CT1s, Form 11s, VAT returns, and CRO
            filings shouldn't mean dozens of spreadsheets. Balnce brings it all
            into one place.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <div className="w-10 h-10 border border-[#E8930C] flex items-center justify-center mb-4">
                <span className="text-[#E8930C] font-['IBM_Plex_Mono'] text-sm font-bold">01</span>
              </div>
              <h3 className="font-['IBM_Plex_Sans'] font-semibold text-black text-lg mb-2">
                All your clients, one dashboard
              </h3>
              <p className="font-['IBM_Plex_Sans'] text-black/50 text-sm leading-relaxed">
                See every client's filing status at a glance. Know what's drafted,
                what's awaiting signature, and what's overdue — without digging
                through folders.
              </p>
            </div>

            <div>
              <div className="w-10 h-10 border border-[#E8930C] flex items-center justify-center mb-4">
                <span className="text-[#E8930C] font-['IBM_Plex_Mono'] text-sm font-bold">02</span>
              </div>
              <h3 className="font-['IBM_Plex_Sans'] font-semibold text-black text-lg mb-2">
                Every Irish tax return covered
              </h3>
              <p className="font-['IBM_Plex_Sans'] text-black/50 text-sm leading-relaxed">
                CT1, Form 11, VAT3, RCT, DWT, VIES, Form 46G, iXBRL — 20 ROS
                filing types plus full CRO coverage. One platform for everything
                Revenue and the CRO need from you.
              </p>
            </div>

            <div>
              <div className="w-10 h-10 border border-[#E8930C] flex items-center justify-center mb-4">
                <span className="text-[#E8930C] font-['IBM_Plex_Mono'] text-sm font-bold">03</span>
              </div>
              <h3 className="font-['IBM_Plex_Sans'] font-semibold text-black text-lg mb-2">
                Your team, your rules
              </h3>
              <p className="font-['IBM_Plex_Sans'] text-black/50 text-sm leading-relaxed">
                Partners, managers, accountants, bookkeepers — everyone gets the
                right level of access. Only senior roles can finalise and file.
                Every change is tracked.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-12 py-24 border-t border-black/10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-['IBM_Plex_Sans'] font-bold text-black text-3xl md:text-4xl mb-4">
            Stop juggling spreadsheets.
          </h2>
          <p className="font-['IBM_Plex_Sans'] text-black/50 text-lg mb-10">
            Join practices already filing smarter with Balnce.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://app.balnce.ie"
              className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest border-2 border-[#E8930C] bg-[#E8930C] px-8 py-4 text-white hover:bg-[#E8930C]/90 transition-colors"
            >
              Get Started
            </a>
            <a
              href="/demo"
              className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest border border-black/20 px-8 py-4 text-black hover:bg-black/5 transition-colors"
            >
              Book a Demo
            </a>
          </div>
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
