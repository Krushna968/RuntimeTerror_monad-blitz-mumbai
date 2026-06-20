"use client";

import React from "react";
import { CheckCircle2, Loader2, PlayCircle, AlertTriangle } from "lucide-react";

export type StepStatus = "idle" | "running" | "completed" | "failed";

export interface AgentStep {
  name: string;
  description: string;
  status: StepStatus;
  result?: any;
}

interface VerifyWorkflowProps {
  steps: AgentStep[];
}

export function VerifyWorkflow({ steps }: VerifyWorkflowProps) {
  const getIcon = (status: StepStatus) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />;
      case "running":
        return <Loader2 className="h-6 w-6 text-brand-purple animate-spin shrink-0" />;
      case "failed":
        return <AlertTriangle className="h-6 w-6 text-brand-pink shrink-0" />;
      case "idle":
      default:
        return <PlayCircle className="h-6 w-6 text-[#231f42] shrink-0" />;
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6 text-left">
      <h3 className="font-display text-lg font-bold text-white mb-4">
        Multi-Agent Execution Log
      </h3>
      <div className="relative border-l border-[#231f42] ml-3 pl-6 space-y-8">
        {steps.map((step, idx) => (
          <div key={idx} className="relative group">
            {/* Step Icon */}
            <div className="absolute -left-[37px] top-0 bg-[#06050b] p-0.5 rounded-full">
              {getIcon(step.status)}
            </div>

            {/* Step Content */}
            <div>
              <h4 className={`font-display text-base font-semibold transition-colors ${
                step.status === "completed" ? "text-emerald-400" :
                step.status === "running" ? "text-brand-purple" :
                step.status === "failed" ? "text-brand-pink" : "text-[#a5a2c2]"
              }`}>
                {step.name}
              </h4>
              <p className="text-sm text-[#8c8aab] mt-1">{step.description}</p>
              
              {/* Expandable Agent JSON Output */}
              {step.result && (
                <div className="mt-3 bg-[#0d0b16] border border-[#231f42] rounded-xl p-3 max-h-40 overflow-y-auto font-mono text-xs text-[#a5a2c2]">
                  <pre>{JSON.stringify(step.result, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
