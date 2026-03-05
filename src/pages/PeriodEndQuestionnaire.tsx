import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useQuestionnaire, useSubmitQuestionnaire } from "@/hooks/usePeriodEndQuestionnaire";
import type { QuestionnaireResponses } from "@/types/accountant";

const QUESTIONS = [
  {
    key: "new_assets_over_1000" as const,
    detailKey: "new_assets_details" as const,
    question: "Did you purchase any new assets over \u20ac1,000?",
    help: "Equipment, vehicles, computers, machinery, furniture, etc.",
    detailPlaceholder: "What was purchased and approximate cost?",
  },
  {
    key: "new_loans_or_finance" as const,
    detailKey: "new_loans_details" as const,
    question: "Any new loans or finance agreements?",
    help: "HP agreements, bank loans, director loans, credit facilities.",
    detailPlaceholder: "Lender, amount, and purpose?",
  },
  {
    key: "staff_changes" as const,
    detailKey: "staff_changes_details" as const,
    question: "Any staff changes during this period?",
    help: "New hires, leavers, salary changes, contractors.",
    detailPlaceholder: "Brief details of the changes?",
  },
  {
    key: "personal_card_business_expenses" as const,
    detailKey: "personal_card_details" as const,
    question: "Did you use a personal card for any business expenses?",
    help: "Any business purchases made from personal accounts.",
    detailPlaceholder: "Approximate total and what types of expenses?",
  },
  {
    key: "income_outside_bank" as const,
    detailKey: "income_outside_details" as const,
    question: "Any income not through the bank account?",
    help: "Cash payments, crypto, foreign transfers, barter.",
    detailPlaceholder: "Source and approximate amount?",
  },
];

export default function PeriodEndQuestionnaire() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: questionnaire, isLoading } = useQuestionnaire(id);
  const submit = useSubmitQuestionnaire();
  const [responses, setResponses] = useState<QuestionnaireResponses | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Initialize responses from questionnaire data
  if (questionnaire && !responses) {
    setResponses(questionnaire.responses);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!questionnaire) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Questionnaire not found or already completed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted || questionnaire.status === "completed" || questionnaire.status === "reviewed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">All done!</h2>
            <p className="text-muted-foreground mb-4">
              Your responses have been sent to your accountant. They'll be in touch if they need anything else.
            </p>
            <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const setAnswer = (key: keyof QuestionnaireResponses, value: unknown) => {
    setResponses((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSubmit = () => {
    if (!responses || !id) return;
    submit.mutate(
      { questionnaireId: id, responses },
      { onSuccess: () => setSubmitted(true) },
    );
  };

  return (
    <div className="min-h-screen bg-secondary py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Year-End Questionnaire</CardTitle>
            <CardDescription>
              Period ending {questionnaire.period_end}. Your accountant needs these answers to prepare your filing.
              Takes about 5 minutes.
            </CardDescription>
          </CardHeader>
        </Card>

        {QUESTIONS.map((q) => (
          <Card key={q.key}>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label className="text-base font-medium">{q.question}</Label>
                <p className="text-sm text-muted-foreground mt-1">{q.help}</p>
              </div>

              <RadioGroup
                value={
                  responses?.[q.key] === true ? "yes" : responses?.[q.key] === false ? "no" : ""
                }
                onValueChange={(val) => setAnswer(q.key, val === "yes")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id={`${q.key}-yes`} />
                  <Label htmlFor={`${q.key}-yes`}>Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id={`${q.key}-no`} />
                  <Label htmlFor={`${q.key}-no`}>No</Label>
                </div>
              </RadioGroup>

              {responses?.[q.key] === true && (
                <Textarea
                  placeholder={q.detailPlaceholder}
                  value={(responses?.[q.detailKey] as string) ?? ""}
                  onChange={(e) => setAnswer(q.detailKey, e.target.value)}
                  rows={3}
                />
              )}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardContent className="pt-6 space-y-4">
            <Label className="text-base font-medium">Anything else your accountant should know?</Label>
            <Textarea
              placeholder="Any other changes, concerns, or notes for this period..."
              value={(responses?.other_notes as string) ?? ""}
              onChange={(e) => setAnswer("other_notes", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Save & Finish Later
          </Button>
          <Button onClick={handleSubmit} disabled={submit.isPending}>
            {submit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit to Accountant
          </Button>
        </div>
      </div>
    </div>
  );
}
