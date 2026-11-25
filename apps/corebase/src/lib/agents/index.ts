import type { PermissionScope } from '@oneorigin/contracts';

export interface ModelIntent {
  goal: string;
  projectId?: string;
  context?: string[];
}

export interface StructuredPlan {
  adapterId: string;
  summary: string;
  steps: string[];
  requiredScopes: PermissionScope[];
  notes: string[];
}

export interface ModelAdapterDescription {
  id: string;
  name: string;
  configured: boolean;
  status: 'ready' | 'disabled';
  limitations: string;
}

/** Provider-neutral model contract. Implementations must state whether they are configured. */
export interface ModelAdapter {
  id: string;
  name: string;
  configured: boolean;
  describe(): ModelAdapterDescription;
  plan(intent: ModelIntent): Promise<StructuredPlan>;
}

const TOPIC_RULES: Array<{ match: RegExp; step: string }> = [
  { match: /文档|doc|readme|write/i, step: 'Draft a Markdown document in the workspace for human review.' },
  { match: /test|检查|verify/i, step: 'List the files to verify and propose read-only checks.' },
  { match: /refactor|code|js|typescript|函数/i, step: 'Inspect the named JavaScript files and describe a minimal change.' },
  { match: /audit|日志|permission|grant/i, step: 'Review the audit view and active grants before proposing any change.' },
];

/** Fully offline, deterministic intent-to-plan adapter. No keys, endpoints or network calls. */
export class OfflinePlanAdapter implements ModelAdapter {
  readonly id = 'offline-plan';
  readonly name = 'Offline deterministic planner';
  readonly configured = true;

  describe(): ModelAdapterDescription {
    return {
      id: this.id,
      name: this.name,
      configured: true,
      status: 'ready',
      limitations: 'Rule-based and offline. Produces inspectable plans only; it never executes actions or calls a model API.',
    };
  }

  async plan(intent: ModelIntent): Promise<StructuredPlan> {
    const goal = intent.goal.trim();
    if (!goal) {
      return {
        adapterId: this.id,
        summary: 'No goal supplied.',
        steps: ['Enter a goal to produce a plan.'],
        requiredScopes: [],
        notes: ['Nothing was executed.'],
      };
    }
    const steps = [
      `Clarify the goal: "${goal}"`,
      ...TOPIC_RULES.filter((rule) => rule.match.test(goal)).map((rule) => rule.step),
      'Present the plan to the human user; require explicit approval for any consequential step.',
    ];
    return {
      adapterId: this.id,
      summary: `Offline plan for: ${goal}`,
      steps,
      requiredScopes: [],
      notes: [
        'Generated locally with deterministic rules.',
        'No credentials, endpoints, telemetry or model API calls are involved.',
        'This plan is advisory; the virtual shell remains the only executor.',
      ],
    };
  }
}

/** Explicitly disabled placeholder. It has no endpoint or key and must never be called. */
export class RemoteOpenAICompatibleStub implements ModelAdapter {
  readonly id = 'remote-openai-compatible';
  readonly name = 'Remote OpenAI-compatible (disabled)';
  readonly configured = false;

  describe(): ModelAdapterDescription {
    return {
      id: this.id,
      name: this.name,
      configured: false,
      status: 'disabled',
      limitations:
        'Not configured. No endpoint, API key or credential is stored in this browser build. This adapter is a stub and is disabled.',
    };
  }

  async plan(_intent?: ModelIntent): Promise<StructuredPlan> {
    throw new Error('Remote OpenAI-compatible adapter is not configured. No API request was made.');
  }
}

export const offlinePlanAdapter = new OfflinePlanAdapter();
export const remoteModelStub = new RemoteOpenAICompatibleStub();
export const modelAdapters: ModelAdapter[] = [offlinePlanAdapter, remoteModelStub];

export function adapterById(id: string): ModelAdapter {
  return modelAdapters.find((adapter) => adapter.id === id) ?? offlinePlanAdapter;
}
