import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, AlertTriangle, Shield, Brain, Eye, FileCheck, Scale, Clock } from "lucide-react";

interface ComplianceItem {
  id: string;
  title: string;
  article: string;
  status: "compliant" | "partial" | "action_needed";
  detail: string;
}

const AI_SYSTEMS = [
  {
    name: "Transaction Auto-Categorisation",
    type: "LLM-powered (Gemini Flash)",
    riskLevel: "Limited Risk",
    riskColor: "text-amber-600 bg-amber-100 dark:bg-amber-950/40",
    article: "Article 50 — Transparency",
    description: "Automatically assigns categories, VAT rates, and confidence scores to bank transactions using AI.",
    dataProcessed: "Transaction descriptions, amounts, dates, vendor names",
    decisions: "Category assignment, VAT rate, business/personal classification",
  },
  {
    name: "Transaction Auto-Matching",
    type: "LLM-powered (Gemini Flash) + Rule-based fallback",
    riskLevel: "Limited Risk",
    riskColor: "text-amber-600 bg-amber-100 dark:bg-amber-950/40",
    article: "Article 50 — Transparency",
    description: "Matches bank transactions to invoices/expenses. Auto-applies matches above 70% confidence.",
    dataProcessed: "Transaction + invoice/expense amounts, descriptions, dates",
    decisions: "Transaction-to-document matching, auto-reconciliation",
  },
  {
    name: "Receipt OCR & Extraction",
    type: "Vision LLM (Gemini Flash)",
    riskLevel: "Limited Risk",
    riskColor: "text-amber-600 bg-amber-100 dark:bg-amber-950/40",
    article: "Article 50 — Transparency",
    description: "Extracts structured data (supplier, amount, VAT, date, line items) from receipt images.",
    dataProcessed: "Receipt images (photos/PDFs)",
    decisions: "Data extraction, field mapping",
  },
  {
    name: "Email Triage & Routing",
    type: "LLM-powered (Gemini Flash)",
    riskLevel: "Limited Risk",
    riskColor: "text-amber-600 bg-amber-100 dark:bg-amber-950/40",
    article: "Article 50 — Transparency",
    description: "Classifies inbound emails as invoices, receipts, statements, spam, etc. Routes based on confidence tiers.",
    dataProcessed: "Email subjects, body text, attachment metadata",
    decisions: "Email classification, auto-file vs manual review routing",
  },
  {
    name: "Vendor Intelligence Lookup",
    type: "LLM-powered with web research",
    riskLevel: "Limited Risk",
    riskColor: "text-amber-600 bg-amber-100 dark:bg-amber-950/40",
    article: "Article 50 — Transparency",
    description: "Researches unknown vendors online to determine business relevance and suggest categories.",
    dataProcessed: "Vendor names, transaction descriptions",
    decisions: "Business vs personal classification, category suggestion",
  },
  {
    name: "Chat Assistant",
    type: "LLM-powered (Claude Sonnet)",
    riskLevel: "Limited Risk",
    riskColor: "text-amber-600 bg-amber-100 dark:bg-amber-950/40",
    article: "Article 50(1) — AI Interaction Disclosure",
    description: "Interactive assistant users chat with to query their financial data.",
    dataProcessed: "User queries, financial summaries",
    decisions: "Conversational responses (no automated decisions)",
  },
  {
    name: "Anomaly Detection",
    type: "Rule-based (no LLM)",
    riskLevel: "Minimal Risk",
    riskColor: "text-green-600 bg-green-100 dark:bg-green-950/40",
    article: "No obligations",
    description: "Detects duplicate transactions, unusual amounts, and stale uncategorised items using statistical rules.",
    dataProcessed: "Transaction amounts, dates, descriptions",
    decisions: "Flagging (advisory only — no auto-action)",
  },
  {
    name: "Vendor Matching (Rule-based)",
    type: "Deterministic (Levenshtein + keyword)",
    riskLevel: "Minimal Risk",
    riskColor: "text-green-600 bg-green-100 dark:bg-green-950/40",
    article: "No obligations",
    description: "Matches transaction descriptions to known vendors using substring and fuzzy matching.",
    dataProcessed: "Transaction descriptions",
    decisions: "Category suggestion with confidence score",
  },
];

const COMPLIANCE_CHECKLIST: ComplianceItem[] = [
  {
    id: "transparency_badge",
    title: "AI categorisation transparency badge",
    article: "Art. 50(1)",
    status: "compliant",
    detail: "ConfidenceBadge component shows AI confidence on categorised transactions with colour-coded levels.",
  },
  {
    id: "ai_interaction",
    title: "AI interaction disclosure (Chat Assistant)",
    article: "Art. 50(1)",
    status: "compliant",
    detail: "Chat assistant is clearly labelled as AI-powered with Brain icon and 'AI Assistant' header.",
  },
  {
    id: "confidence_display",
    title: "Confidence scores visible to users",
    article: "Art. 50(1)",
    status: "compliant",
    detail: "AI Learning widget and CategorizationConfidenceBar show confidence distribution. ConfidenceBadge on transactions.",
  },
  {
    id: "human_override",
    title: "Human override capability",
    article: "Art. 14",
    status: "compliant",
    detail: "Users can manually recategorise any AI-suggested category. User corrections are recorded for learning.",
  },
  {
    id: "audit_logging",
    title: "AI decision audit trail",
    article: "Art. 12",
    status: "compliant",
    detail: "All AI categorisation and matching decisions logged to audit_log table with confidence_score and explanation.",
  },
  {
    id: "auto_match_disclosure",
    title: "Auto-match transparency",
    article: "Art. 50(1)",
    status: "compliant",
    detail: "Auto-matched transactions tagged in notes with [Auto-matched] marker including confidence percentage.",
  },
  {
    id: "risk_classification",
    title: "AI system risk classification documented",
    article: "Art. 6",
    status: "compliant",
    detail: "All AI systems classified as Limited or Minimal risk. No High-Risk or Prohibited uses identified.",
  },
  {
    id: "data_governance",
    title: "Data governance for AI training",
    article: "Art. 10",
    status: "partial",
    detail: "User corrections feed learning via vendor_cache. No formal data governance policy document yet.",
  },
  {
    id: "privacy_disclosure",
    title: "AI features disclosed in privacy policy",
    article: "Art. 50 + GDPR Art. 13",
    status: "action_needed",
    detail: "Privacy policy needs updating to list specific AI features: categorisation, matching, OCR, triage, vendor lookup.",
  },
  {
    id: "incident_reporting",
    title: "Serious incident reporting process",
    article: "Art. 62",
    status: "action_needed",
    detail: "No formal incident reporting process for AI failures. Need to establish monitoring and reporting procedures.",
  },
];

const statusIcon = (status: string) => {
  switch (status) {
    case "compliant": return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case "partial": return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    case "action_needed": return <Circle className="w-4 h-4 text-red-500" />;
    default: return null;
  }
};

export default function AIComplianceTab() {
  const compliant = COMPLIANCE_CHECKLIST.filter((c) => c.status === "compliant").length;
  const total = COMPLIANCE_CHECKLIST.length;
  const percent = Math.round((compliant / total) * 100);

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Compliance</p>
            </div>
            <p className="text-2xl font-bold">{percent}%</p>
            <Progress value={percent} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">AI Systems</p>
            </div>
            <p className="text-2xl font-bold">{AI_SYSTEMS.length}</p>
            <p className="text-xs text-muted-foreground">registered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-4 h-4 text-amber-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Risk Level</p>
            </div>
            <p className="text-2xl font-bold">Limited</p>
            <p className="text-xs text-muted-foreground">highest classification</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-red-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Deadline</p>
            </div>
            <p className="text-2xl font-bold">2 Aug</p>
            <p className="text-xs text-muted-foreground">2026</p>
          </CardContent>
        </Card>
      </div>

      {/* AI System Inventory */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI System Inventory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">System</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Risk Level</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Article</th>
                </tr>
              </thead>
              <tbody>
                {AI_SYSTEMS.map((sys) => (
                  <tr key={sys.name} className="border-b border-border/50">
                    <td className="px-3 py-3">
                      <p className="font-medium text-sm">{sys.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{sys.description}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{sys.type}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sys.riskColor}`}>
                        {sys.riskLevel}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{sys.article}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            Compliance Checklist ({compliant}/{total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {COMPLIANCE_CHECKLIST.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                {statusIcon(item.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{item.article}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transparency Disclosure Template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Active Transparency Disclosures
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-300">In-App AI Disclosure (Article 50)</p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
              "Some features in Balnce use artificial intelligence to categorise transactions, extract receipt data, and match documents.
              AI suggestions are clearly marked with confidence scores. You can always override AI decisions manually.
              All AI decisions are logged for audit purposes."
            </p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium">Confidence Tier Thresholds</p>
            <div className="grid grid-cols-3 gap-3 mt-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span>High (80-100%): Auto-applied</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span>Medium (50-79%): Suggested</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span>Low (&lt;50%): Manual review</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
