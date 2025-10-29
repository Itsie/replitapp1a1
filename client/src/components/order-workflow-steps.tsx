import { Check, X, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowStep {
  id: string;
  label: string;
  status: "completed" | "active" | "pending" | "failed" | "blocked";
  hint?: string;
}

interface OrderWorkflowStepsProps {
  hasPositions: boolean;
  hasPrice: boolean;
  hasAssets: boolean;
  hasProduction: boolean;
  hasMissingParts: boolean;
  isSettled: boolean;
  workflow: string;
}

export function OrderWorkflowSteps({
  hasPositions,
  hasPrice,
  hasAssets,
  hasProduction,
  hasMissingParts,
  isSettled,
  workflow,
}: OrderWorkflowStepsProps) {
  const steps: WorkflowStep[] = [
    {
      id: "positions",
      label: "Positionen",
      status: hasPositions ? "completed" : "pending",
      hint: hasPositions ? undefined : "Keine Positionen vorhanden",
    },
    {
      id: "price",
      label: "Preis",
      status: hasPrice ? "completed" : "pending",
      hint: hasPrice ? undefined : "Kein Preis gesetzt",
    },
    {
      id: "assets",
      label: "Druckdaten",
      status: hasAssets ? "completed" : "pending",
      hint: hasAssets ? undefined : "Pflichtdaten fehlen",
    },
    {
      id: "production",
      label: "Produktion",
      status: hasProduction ? "completed" : workflow === "IN_PROD" || workflow === "FUER_PROD" ? "active" : "pending",
      hint: hasProduction ? undefined : workflow === "IN_PROD" || workflow === "FUER_PROD" ? "In Produktion" : "Noch nicht freigegeben",
    },
  ];

  // Add missing parts step if needed
  if (hasMissingParts) {
    steps.push({
      id: "missing",
      label: "Fehlteile",
      status: "failed",
      hint: "Wartet auf Fehlteile",
    });
  }

  // Add settlement step
  steps.push({
    id: "settlement",
    label: "Abrechnung",
    status: isSettled ? "completed" : workflow === "ZUR_ABRECHNUNG" ? "active" : "pending",
    hint: isSettled ? "Abgerechnet" : workflow === "ZUR_ABRECHNUNG" ? "Zur Abrechnung" : undefined,
  });

  const getStepIcon = (status: WorkflowStep["status"]) => {
    switch (status) {
      case "completed":
        return <Check className="h-4 w-4" />;
      case "failed":
      case "blocked":
        return <X className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStepColor = (status: WorkflowStep["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30";
      case "active":
        return "bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30";
      case "failed":
        return "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30";
      case "blocked":
        return "bg-orange-500/10 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30";
      default:
        return "bg-muted/30 text-muted-foreground border-muted";
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="workflow-steps">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md border transition-all",
              getStepColor(step.status)
            )}
            title={step.hint}
            data-testid={`workflow-step-${step.id}`}
          >
            {getStepIcon(step.status)}
            <span className="text-sm font-medium">{step.label}</span>
            {step.hint && (
              <AlertTriangle className="h-3 w-3 ml-1 opacity-50" />
            )}
          </div>
          {index < steps.length - 1 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}
