import { Link } from "react-router-dom";
import PenguinIcon from "@/components/PenguinIcon";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <PenguinIcon className="w-6 h-6" />
          <span className="text-sm">Back to Balnce</span>
        </Link>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: 8 March 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold">1. Who We Are</h2>
            <p>
              Balnce is operated by Balnce Ltd, registered in Ireland. We provide automated bookkeeping,
              tax compliance, and accounting software for Irish businesses and their accountants.
            </p>
            <p>
              <strong>Data Controller:</strong> Balnce Ltd<br />
              <strong>Contact:</strong> jamie@balnce.ie
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account data:</strong> Email address, name, business name, company registration details</li>
              <li><strong>Financial data:</strong> Bank transaction CSV imports, invoice data, expense records, receipt images</li>
              <li><strong>Tax data:</strong> VAT registration status, RCT status, director details, relief claims</li>
              <li><strong>Usage data:</strong> Page views, feature usage (via PostHog analytics), error reports (via Sentry)</li>
              <li><strong>Communication data:</strong> Inbound emails forwarded to your Balnce email address</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Providing bookkeeping, categorisation, and tax calculation services</li>
              <li>Generating CT1, Form 11, VAT3, and other tax returns</li>
              <li>Processing receipts and matching them to transactions</li>
              <li>AI-powered features (see Section 7 below)</li>
              <li>Product improvement and analytics</li>
              <li>Communication about your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Legal Basis (GDPR Art. 6)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Contract performance:</strong> Processing your financial data to provide our service</li>
              <li><strong>Legitimate interest:</strong> Product analytics, fraud prevention, service improvement</li>
              <li><strong>Legal obligation:</strong> Tax record-keeping requirements under Irish law</li>
              <li><strong>Consent:</strong> Marketing communications (opt-in only)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Data Sharing</h2>
            <p>We share data with the following processors:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Supabase (EU):</strong> Database hosting and authentication</li>
              <li><strong>OpenRouter / Google AI:</strong> AI model inference for categorisation and OCR (see Section 7)</li>
              <li><strong>PostHog (EU):</strong> Product analytics</li>
              <li><strong>Sentry:</strong> Error monitoring</li>
              <li><strong>Vercel:</strong> Application hosting</li>
            </ul>
            <p>We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Data Retention</h2>
            <p>
              Financial records are retained for 6 years in line with Irish Revenue requirements (Section 886 TCA 1997).
              Account data is deleted upon request, subject to legal retention obligations.
            </p>
          </section>

          <section className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              7. Artificial Intelligence Features (EU AI Act Disclosure)
            </h2>
            <p className="mt-2">
              Balnce uses artificial intelligence to assist with bookkeeping tasks. Under the EU AI Act
              (Regulation 2024/1689), we are required to inform you about our AI systems.
              All AI systems in Balnce are classified as <strong>Limited Risk</strong> or <strong>Minimal Risk</strong>.
            </p>

            <h3 className="text-base font-semibold mt-4">AI Systems We Use</h3>

            <div className="space-y-3 mt-2">
              <div className="border rounded-lg p-3 bg-background">
                <p className="font-medium text-sm">Transaction Auto-Categorisation</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Uses Google Gemini AI to suggest transaction categories, VAT rates, and business purpose.
                  Confidence scores (0-100%) determine whether suggestions are auto-applied (&ge;80%),
                  shown as suggestions (50-79%), or flagged for manual review (&lt;50%).
                </p>
              </div>

              <div className="border rounded-lg p-3 bg-background">
                <p className="font-medium text-sm">Transaction Auto-Matching</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Matches bank transactions to invoices and expenses using AI analysis with rule-based fallback.
                  Auto-applies matches above 70% confidence. All matches are logged for audit.
                </p>
              </div>

              <div className="border rounded-lg p-3 bg-background">
                <p className="font-medium text-sm">Receipt OCR & Data Extraction</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Uses vision AI to extract supplier name, date, amount, VAT, and line items from receipt
                  photos and PDFs. Extracted data is always reviewable and editable by users.
                </p>
              </div>

              <div className="border rounded-lg p-3 bg-background">
                <p className="font-medium text-sm">Email Triage & Document Routing</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Classifies inbound emails as invoices, receipts, or other document types.
                  Routes based on confidence: &ge;90% auto-filed, 70-89% pending review, &lt;70% sent to accountant.
                </p>
              </div>

              <div className="border rounded-lg p-3 bg-background">
                <p className="font-medium text-sm">Vendor Intelligence</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Researches unknown vendors using AI-powered web search to determine if expenses are
                  business or personal. Returns explanation and sources for transparency.
                </p>
              </div>

              <div className="border rounded-lg p-3 bg-background">
                <p className="font-medium text-sm">Chat Assistant</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Interactive AI assistant (Claude by Anthropic) for querying your financial data.
                  Clearly identified as an AI system. Does not make automated decisions.
                </p>
              </div>
            </div>

            <h3 className="text-base font-semibold mt-4">Your Rights Regarding AI</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm mt-2">
              <li><strong>Override:</strong> You can manually change any AI-suggested category or match at any time</li>
              <li><strong>Transparency:</strong> AI suggestions are marked with confidence badges in the interface</li>
              <li><strong>Audit trail:</strong> All AI decisions are logged with confidence scores and explanations</li>
              <li><strong>Learning:</strong> Your corrections improve future AI suggestions for your account</li>
              <li><strong>No profiling:</strong> AI is not used for profiling, credit scoring, or automated decisions with legal effects</li>
            </ul>

            <h3 className="text-base font-semibold mt-4">AI Data Processing</h3>
            <p className="text-sm mt-1">
              Transaction descriptions and receipt images are sent to AI models (Google Gemini via OpenRouter)
              for processing. This data is used solely for providing our service and is not used to train
              third-party AI models. AI processing is covered by our data processing agreements with
              OpenRouter and Google.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Your Rights (GDPR)</h2>
            <p>Under GDPR, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate data</li>
              <li><strong>Erasure:</strong> Request deletion of your data (subject to legal retention)</li>
              <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
              <li><strong>Object:</strong> Object to processing based on legitimate interest</li>
              <li><strong>Restrict:</strong> Request restriction of processing</li>
              <li><strong>Withdraw consent:</strong> Where processing is based on consent</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, contact us at <strong>jamie@balnce.ie</strong>.
              We will respond within 30 days as required by GDPR.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Data Protection Authority</h2>
            <p>
              If you are unsatisfied with our response, you may lodge a complaint with the
              Data Protection Commission (DPC), Ireland's supervisory authority:
            </p>
            <p className="mt-1">
              Data Protection Commission<br />
              21 Fitzwilliam Square South, Dublin 2, D02 RD28<br />
              Website: dataprotection.ie
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Changes to This Policy</h2>
            <p>
              We may update this policy to reflect changes in our practices or legal requirements.
              We will notify users of material changes via email or in-app notification.
            </p>
          </section>
        </div>

        <div className="border-t mt-12 pt-6 text-center text-xs text-muted-foreground">
          Balnce Ltd &middot; Ireland &middot; jamie@balnce.ie
        </div>
      </div>
    </div>
  );
}
