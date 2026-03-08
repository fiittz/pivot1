import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";
import CategorizationConfidenceBar from "@/components/bank/CategorizationConfidenceBar";

interface Props {
  categorizationRate: number;
  aiAccuracy: number;
  confidenceDistribution: { high: number; medium: number; low: number };
  totalTransactions: number;
}

export default function AILearningWidget({ categorizationRate, aiAccuracy, confidenceDistribution, totalTransactions }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="w-4 h-4" />
          AI Learning
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{categorizationRate}%</p>
            <p className="text-[10px] text-muted-foreground">Auto-categorised</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{aiAccuracy}%</p>
            <p className="text-[10px] text-muted-foreground">AI Accuracy</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium mb-2">Confidence Distribution</p>
          <CategorizationConfidenceBar
            high={confidenceDistribution.high}
            medium={confidenceDistribution.medium}
            low={confidenceDistribution.low}
            total={totalTransactions}
          />
        </div>

        <p className="text-[10px] text-muted-foreground">
          The AI improves as you categorise more transactions. Corrections train the model for better future predictions.
        </p>
      </CardContent>
    </Card>
  );
}
