import type { ExecutionPlan } from '@oneorigin/contracts';
import type { ParsedCommand } from '../helpers';

/**
 * Adapter-neutral fields the lifecycle attaches to a plan. Adapters that do not need them
 * simply ignore them; the contract's ExecutionPlan shape is preserved.
 */
export interface ManagedPlan extends ExecutionPlan {
  parsed?: ParsedCommand;
  destructive?: boolean;
  mutates?: boolean;
  baseline?: Record<string, string>;
  projectId?: string;
  cwd?: string;
}

export function managedPlan(plan: ExecutionPlan): ManagedPlan {
  return plan as ManagedPlan;
}
