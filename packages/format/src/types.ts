export type Sensitivity = "public" | "internal" | "confidential" | "restricted";
export type Needs = "none" | "shell" | "browser" | "screen";
export type Reversible = "yes" | "no" | "unsure";

export interface WorkflowInput {
  id: string;
  what: string;
  source: string;
  sensitivity: Sensitivity;
}

export interface WorkflowStep {
  id: string;
  order: number;
  action: string;
  role: string;
  needs: Needs;
  expected_result: string;
  reversible: Reversible;
  tools?: string[];
  inputs_used?: string[];
  approval?: "each";
}

export interface Workflow {
  format: "relay/1";
  name: string;
  purpose: string;
  description?: string;
  tags?: string[];
  inputs?: WorkflowInput[];
  steps: WorkflowStep[];
  never_automate?: string[];
}

export type RunStatus = "succeeded" | "failed" | "stopped";
export type RunStepStatus = "done" | "failed" | "skipped" | "stopped" | "not_run";

export interface RunStep {
  id: string;
  role: string;
  device?: string;
  status: RunStepStatus;
  approved_by?: string;
  started_at?: string;
  ended_at?: string;
  summary?: string;
  outputs?: Record<string, string>;
}

export interface Run {
  format: "relay-run/1";
  run_id: string;
  workflow_commit: string;
  started_by: string;
  started_at: string;
  ended_at: string;
  status: RunStatus;
  note?: string;
  steps: RunStep[];
}

export interface Problem {
  path: string;
  message: string;
  level: "error" | "warning";
}
