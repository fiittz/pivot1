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
        <p className="text-sm text-muted-foreground mb-8">Last updated: 13 March 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold">1. Who We Are</h2>
            <p>
              Balnce is operated by Balance Your Accounting Limited (trading as Balnce), registered in Ireland.
              We provide tax filing, compliance, and practice management software for Irish accountants and their clients.
            </p>
            <p>
              <strong>Data Controller:</strong> Balance Your Accounting Limited (t/a Balnce)<br />
              <strong>Address:</strong> 3rd Floor, 61 Thomas St, The Liberties, Dublin 8, D08 W250, Ireland<br />
              <strong>Contact:</strong> hello@balnce.ie
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account data:</strong> Email address, name, practice details, team member information</li>
              <li><strong>TAIN digital certificates:</strong> .p12 certificate files uploaded for ROS authentication (see Section 7)</li>
              <li><strong>Client data synced from ROS:</strong> PPS numbers, tax reference numbers, financial data, tax credits, preliminary tax, RCT records, payroll liabilities, and LPT records</li>
              <li><strong>Filing records:</strong> CT1, Form 11, VAT3, CRO B1/Abridged filings, workspace data, and generated ROS XML / CRO PDF documents</li>
              <li><strong>E-signatures:</strong> Client signatures captured via the client portal for filing authorisation (see Section 8)</li>
              <li><strong>Usage data:</strong> Page views, feature usage (via PostHog EU analytics), error reports (via Sentry)</li>
              <li><strong>Payment data:</strong> Subscription and billing information processed via Stripe (we do not store card details)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Generating CT1, Form 11, VAT3, CRO B1, and other statutory filings</li>
              <li>Syncing client data from Revenue via the ROS API using your TAIN certificate</li>
              <li>Building and managing filing workspaces with pre-populated client data</li>
              <li>Processing e-signatures from clients to authorise filing submissions</li>
              <li>Managing subscriptions, billing, and practice-level access</li>
              <li>AI-assisted features (see Section 9 below)</li>
              <li>Product improvement and analytics</li>
              <li>Communication about your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Legal Basis (GDPR Art. 6)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Contract performance:</strong> Processing your data to provide our filing and practice management service</li>
              <li><strong>Legitimate interest:</strong> Product analytics, fraud prevention, service improvement</li>
              <li><strong>Legal obligation:</strong> Tax record-keeping requirements under Irish law</li>
              <li><strong>Consent:</strong> Marketing communications (opt-in only)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Data Sharing</h2>
            <p>We share data with the following processors:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Convex:</strong> Database hosting and reactive backend</li>
              <li><strong>Convex Auth:</strong> Authentication and session management</li>
              <li><strong>Stripe:</strong> Payment processing and subscription management</li>
              <li><strong>Resend:</strong> Transactional email delivery</li>
              <li><strong>PostHog (EU):</strong> Product analytics</li>
              <li><strong>Sentry:</strong> Error monitoring</li>
              <li><strong>Vercel:</strong> Application hosting</li>
              <li><strong>Revenue Online Service (ROS):</strong> Filing submission and client data retrieval via authenticated API</li>
            </ul>
            <p>We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Data Retention</h2>
            <p>
              Financial records and filing data are retained for 6 years in line with Irish Revenue requirements (Section 886 TCA 1997).
              Account data is deleted upon request, subject to legal retention obligations.
              TAIN certificates can be revoked and deleted at any time via your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. TAIN Certificate Handling</h2>
            <p>
              To connect your practice to the Revenue Online Service (ROS), you upload your TAIN .p12 digital certificate.
              This certificate is used solely for authenticating with the ROS API on your behalf to sync client data
              and submit filings.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Certificates are stored securely and encrypted at rest</li>
              <li>Certificates are used only for ROS API authentication &mdash; never shared with any other processor</li>
              <li>You can revoke and delete your certificate at any time from your account settings</li>
              <li>Daily automated syncs (client data, tax credits, RCT, payroll, LPT) use your stored certificate</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Client Portal &amp; E-Signatures</h2>
            <p>
              Balnce includes a client portal where your clients can review filing summaries and provide
              electronic signatures to authorise submissions.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Clients see a read-only summary of their filing &mdash; they cannot modify data</li>
              <li>E-signatures are captured securely and stored alongside the associated filing record</li>
              <li>Signatures are used solely for the purpose of authorising specific filings</li>
              <li>Client portal access is time-limited and scoped to the relevant filing only</li>
            </ul>
          </section>

          <section className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              9. Artificial Intelligence Features (EU AI Act Disclosure)
            </h2>
            <p className="mt-2">
              Balnce uses a learning engine to assist with tax filing. Under the EU AI Act
              (Regulation 2024/1689), we are required to inform you about our AI systems.
              All AI systems in Balnce are classified as <strong>Minimal Risk</strong>.
            </p>

            <h3 className="text-base font-semibold mt-4">AI System</h3>

            <div className="space-y-3 mt-2">
              <div className="border rounded-lg p-3 bg-background">
                <p className="font-medium text-sm">Deduction &amp; Credit Suggestions</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Analyses patterns in client financial data to suggest applicable tax deductions, credits,
                  and reliefs. All suggestions are presented for accountant review &mdash; no automated decisions
                  are made without human confirmation.
                </p>
              </div>
            </div>

            <h3 className="text-base font-semibold mt-4">Your Rights Regarding AI</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm mt-2">
              <li><strong>Override:</strong> You can accept, modify, or reject any AI suggestion at any time</li>
              <li><strong>Transparency:</strong> AI suggestions are clearly marked in the interface</li>
              <li><strong>No profiling:</strong> AI is not used for profiling, credit scoring, or automated decisions with legal effects</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Your Rights (GDPR)</h2>
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
              To exercise these rights, contact us at <strong>hello@balnce.ie</strong>.
              We will respond within 30 days as required by GDPR.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Data Protection Authority</h2>
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
            <h2 className="text-xl font-semibold">12. Changes to This Policy</h2>
            <p>
              We may update this policy to reflect changes in our practices or legal requirements.
              We will notify users of material changes via email or in-app notification.
            </p>
          </section>
        </div>

        <div className="border-t mt-12 pt-6 text-center text-xs text-muted-foreground">
          Balance Your Accounting Limited (t/a Balnce) &middot; 3rd Floor, 61 Thomas St, The Liberties, Dublin 8, D08 W250 &middot; hello@balnce.ie
        </div>
      </div>
    </div>
  );
}
