import { Link } from "react-router-dom";
import PenguinIcon from "@/components/PenguinIcon";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
          <PenguinIcon className="w-6 h-6" />
          <span className="text-sm">Back to Balnce</span>
        </Link>

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: 13 March 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold">1. Introduction</h2>
            <p>
              These Terms of Service ("Terms") govern your use of Balnce, a tax filing and practice management
              platform operated by Balance Your Accounting Limited (t/a Balnce), a company registered in Ireland
              ("we", "us", "our").
            </p>
            <p>
              By creating an account or using our service, you agree to these Terms. If you do not agree,
              do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Service Description</h2>
            <p>Balnce provides:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Practice management tools for Irish accounting practices</li>
              <li>Tax filing workspace for CT1, Form 11, VAT3, CRO B1, and Abridged Accounts</li>
              <li>Integration with Revenue Online Service (ROS) for data sync and filing submission</li>
              <li>Client portal for document review and e-signatures</li>
              <li>Import from third-party accounting software (Xero, Sage, QuickBooks, CSV)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Account Registration</h2>
            <p>
              To use Balnce, you must create an account with a valid email address and password.
              You are responsible for maintaining the security of your account credentials and for
              all activity under your account.
            </p>
            <p>
              You must be at least 18 years old and authorised to act on behalf of your accounting
              practice to register for an account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Subscription & Billing</h2>
            <p>
              Balnce is offered on a subscription basis with monthly billing. Plans vary by client
              capacity and features. All prices are quoted in euro and exclude VAT.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Payment is processed securely via Stripe</li>
              <li>Subscriptions renew automatically each month unless cancelled</li>
              <li>You may cancel your subscription at any time — access continues until the end of the billing period</li>
              <li>Usage-based filing fees may apply and are discussed during onboarding</li>
              <li>We reserve the right to change pricing with 30 days' notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. TAIN Certificate & ROS Access</h2>
            <p>
              Balnce allows you to upload your TAIN .p12 digital certificate to authenticate with
              Revenue Online Service (ROS) on your behalf.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your certificate is stored securely and encrypted at rest</li>
              <li>It is used solely for authenticating with ROS to sync client data and submit filings</li>
              <li>You may revoke access and delete your certificate at any time from your settings</li>
              <li>You are responsible for ensuring your TAIN certificate is valid and that you are authorised to act as agent for the clients linked to it</li>
              <li>Balnce does not modify your ROS agent-client relationships</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Filing Accuracy & Professional Responsibility</h2>
            <p>
              Balnce is a tool to assist qualified accountants and tax advisors. It is not a substitute
              for professional judgement.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>You are responsible for reviewing and verifying all figures before filing</li>
              <li>Balnce generates filings based on data you provide — we do not guarantee accuracy of source data</li>
              <li>Tax calculations are based on current legislation but may not reflect recent changes until updated</li>
              <li>Suggested deductions and credits are advisory — final decisions rest with the accountant</li>
              <li>You remain professionally and legally responsible for all filings submitted through the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Client Portal & E-Signatures</h2>
            <p>
              Balnce provides a client portal where your clients can review filing summaries and
              provide electronic signatures.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Client portal access is read-only — clients cannot modify filing data</li>
              <li>E-signatures are captured and stored securely as part of the filing record</li>
              <li>You are responsible for ensuring your clients consent to electronic signing</li>
              <li>Signed documents are available for download and audit</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Share your TAIN certificate or account credentials with unauthorised parties</li>
              <li>Use the service for any unlawful purpose, including tax fraud or evasion</li>
              <li>Attempt to access data belonging to other practices or clients</li>
              <li>Reverse-engineer, decompile, or interfere with the platform</li>
              <li>Upload malicious files or attempt to compromise system security</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Data Ownership</h2>
            <p>
              Your data is yours. You retain full ownership of all client data, filing records,
              and documents uploaded to Balnce. We do not claim any ownership or intellectual
              property rights over your data.
            </p>
            <p>
              You may export your data at any time. Upon account termination, we will retain
              data for the legally required period (6 years per Section 886 TCA 1997) and then
              delete it, unless you request earlier deletion of non-legally-required data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Service Availability</h2>
            <p>
              We aim to provide a reliable service but do not guarantee uninterrupted access.
              We may perform scheduled maintenance with reasonable notice. We are not liable for
              downtime caused by factors outside our control, including ROS outages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by Irish law:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Balnce is provided "as is" without warranties of any kind</li>
              <li>We are not liable for any indirect, incidental, or consequential damages arising from your use of the service</li>
              <li>Our total liability is limited to the amount you have paid us in the 12 months preceding the claim</li>
              <li>We are not liable for penalties, interest, or other consequences arising from late or incorrect filings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">12. Termination</h2>
            <p>
              You may close your account at any time from your settings or by contacting us.
              We may suspend or terminate your account if you breach these Terms, with notice
              where practicable.
            </p>
            <p>
              Upon termination, your access to the platform ceases. Data retention is governed
              by our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">13. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes
              via email or in-app notification at least 30 days before they take effect. Continued
              use of the service after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">14. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of Ireland.
              Any disputes arising from these Terms or your use of the service shall be subject to
              the exclusive jurisdiction of the Irish courts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">15. Contact</h2>
            <p>
              If you have questions about these Terms, contact us at:
            </p>
            <p className="mt-1">
              Balance Your Accounting Limited (t/a Balnce)<br />
              3rd Floor, 61 Thomas St, The Liberties, Dublin 8, D08 W250<br />
              Email: <a href="mailto:hello@balnce.ie" className="text-primary hover:underline">hello@balnce.ie</a>
            </p>
          </section>
        </div>

        <div className="border-t mt-12 pt-6 text-center text-xs text-muted-foreground">
          Balance Your Accounting Limited (t/a Balnce) &middot; Ireland &middot; hello@balnce.ie
        </div>
      </div>
    </div>
  );
}
