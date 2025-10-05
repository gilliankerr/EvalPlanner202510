import { FileText, Sparkles, FileCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface WorkflowPhase {
  id: string;
  label: string;
  icon: LucideIcon;
  steps: number[];
  statusMessages: { [stepId: number]: string };
}

export const WORKFLOW_PHASES: WorkflowPhase[] = [
  {
    id: 'input',
    label: 'Provide information',
    icon: FileText,
    steps: [1, 2],
    statusMessages: {
      1: 'Collecting program information...',
      2: 'Extracting content from websites...'
    }
  },
  {
    id: 'analysis',
    label: 'AI analysis',
    icon: Sparkles,
    steps: [3, 4, 5],
    statusMessages: {
      3: 'Analyzing program model...',
      4: 'Building evaluation framework...',
      5: 'Creating comprehensive plan...'
    }
  },
  {
    id: 'output',
    label: 'Your report',
    icon: FileCheck,
    steps: [6],
    statusMessages: {
      6: 'Generating final report...'
    }
  }
];

export function getPhaseForStep(stepNumber: number): WorkflowPhase | undefined {
  return WORKFLOW_PHASES.find(phase => phase.steps.includes(stepNumber));
}

export function getStatusMessage(stepNumber: number): string {
  const phase = getPhaseForStep(stepNumber);
  return phase?.statusMessages[stepNumber] || 'Processing...';
}

export function isPhaseComplete(phaseId: string, completedSteps: number[]): boolean {
  const phase = WORKFLOW_PHASES.find(p => p.id === phaseId);
  if (!phase) return false;
  return phase.steps.every(step => completedSteps.includes(step));
}

export function isPhaseActive(phaseId: string, currentStep: number): boolean {
  const phase = WORKFLOW_PHASES.find(p => p.id === phaseId);
  if (!phase) return false;
  return phase.steps.includes(currentStep);
}

export const TOTAL_STEPS = WORKFLOW_PHASES.reduce((total, phase) => total + phase.steps.length, 0);
