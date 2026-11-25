<script lang="ts">
  import { onMount } from 'svelte';
  import type { AuditEntry, Grant } from '@oneorigin/contracts';
  import { randomId } from '@oneorigin/contracts';
  import {
    Bot,
    LoaderCircle,
    PencilLine,
    ScrollText,
    Settings,
    SquareTerminal,
  } from '@lucide/svelte';
  import ActionDialog from '../lib/components/ActionDialog.svelte';
  import AgentsPanel from '../lib/components/AgentsPanel.svelte';
  import ApprovalDialog from '../lib/components/ApprovalDialog.svelte';
  import AuditPanel from '../lib/components/AuditPanel.svelte';
  import Header from '../lib/components/Header.svelte';
  import SettingsPanel from '../lib/components/SettingsPanel.svelte';
  import Sidebar from '../lib/components/Sidebar.svelte';
  import TerminalPanel from '../lib/components/TerminalPanel.svelte';
  import { adapterById, modelAdapters, type StructuredPlan } from '../lib/agents';
  import { createUserCheckpoint, restoreUserCheckpoint } from '../lib/checkpoints';
  import { GENESIS_HASH, verifyAuditChain } from '../lib/execution/audit';
  import { runLifecycleCommand } from '../lib/execution/lifecycle';
  import { SHELL_ADAPTER_ID, VirtualShellAdapter } from '../lib/execution/virtual-shell';
  import { resolveVirtualPath } from '../lib/helpers';
  import { revokeGrant } from '../lib/permissions';
  import * as store from '../lib/storage';
  import type {
    AppSettings,
    ApprovalRequest,
    ChainReport,
    Checkpoint,
    LifecycleStage,
    Project,
    TabId,
    TerminalLine,
    VirtualFile,
  } from '../lib/types';

  const shellAdapter = new VirtualShellAdapter();
  const fallbackSettings: AppSettings = {
    key: 'settings',
    activeAdapterId: SHELL_ADAPTER_ID,
    activeModelAdapterId: 'offline-plan',
    approvalsEnabled: true,
    contentTelemetry: false,
  };

  const tabs = [
    { id: 'editor' as const, label: 'Editor', icon: PencilLine },
    { id: 'terminal' as const, label: 'Terminal', icon: SquareTerminal },
    { id: 'audit' as const, label: 'Audit', icon: ScrollText },
    { id: 'agents' as const, label: 'Agents', icon: Bot },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  const stageLabels: Record<LifecycleStage, string> = {
    intent: 'Recording intent',
    plan: 'Planning',
    authorization: 'Authorizing',
    'awaiting-approval': 'Awaiting approval',
    execution: 'Executing',
    verification: 'Verifying',
    persistence: 'Persisting',
    provenance: 'Recording provenance',
    result: 'Completed',
  };

  type DialogState =
    | { kind: 'new-project' }
    | { kind: 'new-file' }
    | { kind: 'delete-file'; path: string }
    | { kind: 'checkpoint' };

  let ready = $state(false);
  let projects = $state<Project[]>([]);
  let files = $state<VirtualFile[]>([]);
  let activeProjectId = $state('');
  let activePath = $state<string | null>(null);
  let editorContent = $state('');
  let dirty = $state(false);
  let tab = $state<TabId>('editor');
  type EditorComponent = typeof import('../lib/components/EditorPanel.svelte').default;
  let EditorPanel = $state<EditorComponent | null>(null);
  let sidebarOpen = $state(false);
  let status = $state('Idle');

  let terminalLines = $state<TerminalLine[]>([]);
  let terminalHistory = $state<string[]>([]);
  let sessionId = $state('');
  let cwd = $state('');
  let busy = $state(false);

  let grants = $state<Grant[]>([]);
  let auditEntries = $state<AuditEntry[]>([]);
  let chain = $state<ChainReport>({ ok: true, head: GENESIS_HASH, entries: 0 });
  let checkpoints = $state<Checkpoint[]>([]);
  let settings = $state<AppSettings | null>(null);

  let approvalRequest = $state<ApprovalRequest | null>(null);
  let approvalResolver: ((approved: boolean) => void) | null = null;
  let dialog = $state<DialogState | null>(null);

  let goal = $state('');
  let lastPlan = $state<StructuredPlan | null>(null);
  let agentError = $state('');

  let activeProject = $derived(projects.find((project) => project.id === activeProjectId) ?? null);
  let activeFile = $derived(
    files.find((file) => file.projectId === activeProjectId && file.path === activePath) ?? null,
  );
  let adapterDescriptions = modelAdapters.map((adapter) => adapter.describe());

  onMount(() => {
    void initialize();
    void import('../lib/components/EditorPanel.svelte').then((module) => {
      EditorPanel = module.default;
    });
  });

  async function initialize(): Promise<void> {
    await store.seedIfNeeded();
    projects = await store.listProjects();
    settings = await store.getSettings();
    await refreshGrants();
    await refreshAudit();
    if (projects.length > 0) await selectProject(projects[0].id);
    await refreshCheckpoints();
    ready = true;
    status = 'Ready';
  }

  async function refreshAudit(): Promise<void> {
    auditEntries = await store.getAuditEntries();
    chain = await verifyAuditChain(auditEntries);
  }

  async function refreshGrants(): Promise<void> {
    grants = await store.listGrants();
  }

  async function refreshCheckpoints(): Promise<void> {
    checkpoints = activeProjectId ? await store.listCheckpoints(activeProjectId) : [];
  }

  async function persistSession(): Promise<void> {
    if (!sessionId || !activeProjectId) return;
    const existing = await store.getSession(sessionId);
    await store.putSession({
      id: sessionId,
      projectId: activeProjectId,
      cwd,
      history: [...terminalHistory],
      lines: [...terminalLines],
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async function loadProjectState(): Promise<void> {
    files = await store.listFiles(activeProjectId);
    const sessions = await store.listSessions(activeProjectId);
    let session = sessions[0];
    if (!session) {
      const at = new Date().toISOString();
      session = {
        id: randomId(),
        projectId: activeProjectId,
        cwd: '',
        history: [],
        lines: [],
        createdAt: at,
        updatedAt: at,
      };
      await store.putSession(session);
    }
    sessionId = session.id;
    cwd = session.cwd;
    terminalHistory = [...session.history];
    terminalLines = [...session.lines];
    const current = files.find((file) => file.projectId === activeProjectId && file.path === activePath);
    if (!current) {
      const first = files.find((file) => file.kind === 'file');
      activePath = first?.path ?? null;
      editorContent = first?.content ?? '';
      dirty = false;
    }
  }

  async function selectProject(id: string): Promise<void> {
    if (id === activeProjectId && ready) return;
    if (dirty && activePath) await saveCurrentFile();
    activeProjectId = id;
    activePath = null;
    await loadProjectState();
    await refreshCheckpoints();
  }

  async function openFile(path: string): Promise<void> {
    if (dirty && activePath && activePath !== path) await saveCurrentFile();
    const file = await store.getFile(activeProjectId, path);
    if (!file) return;
    activePath = file.path;
    editorContent = file.content;
    dirty = false;
  }

  async function auditDirectAction(summary: string, data: Record<string, unknown>): Promise<void> {
    const actor = 'guest';
    await store.appendAuditEntry({ stage: 'intent', actor, summary, data });
    await store.appendAuditEntry({
      stage: 'authorization',
      actor,
      summary: `Human editor action: ${summary}`,
      data: { decision: 'allow', basis: 'human UI action', scopes: [] },
    });
    await store.appendAuditEntry({ stage: 'execution', actor, summary: `Applied: ${summary}`, data });
    await store.appendAuditEntry({
      stage: 'verification',
      actor,
      summary: 'Workspace state check recorded',
      data: { checks: [{ name: 'expectedState', passed: true, detail: 'Editor change written to the virtual filesystem.' }] },
    });
    await store.appendAuditEntry({ stage: 'persistence', actor, summary: `Persisted: ${summary}`, data: { ...data, checkpointRef: null } });
    await store.appendAuditEntry({ stage: 'provenance', actor, summary: 'Editor action linked to the audit chain', data });
    await store.appendAuditEntry({ stage: 'result', actor, summary: `Completed: ${summary}`, data: { ok: true } });
    await refreshAudit();
  }

  async function saveCurrentFile(): Promise<void> {
    if (!activePath) return;
    const existing = await store.getFile(activeProjectId, activePath);
    if (!existing) return;
    await store.putFile({ ...existing, content: editorContent, updatedAt: new Date().toISOString() });
    dirty = false;
    files = await store.listFiles(activeProjectId);
    await auditDirectAction(`Save file ${activePath}`, { projectId: activeProjectId, path: activePath });
  }

  async function createProject(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    const at = new Date().toISOString();
    const project: Project = {
      id: `proj_${Date.now().toString(36)}`,
      name: trimmed,
      description: 'Local guest workspace.',
      createdAt: at,
      updatedAt: at,
    };
    await store.saveProject(project);
    projects = await store.listProjects();
    await auditDirectAction(`Create project ${trimmed}`, { projectId: project.id });
    await selectProject(project.id);
    await refreshCheckpoints();
    status = 'Project created';
  }

  async function createFile(rawPath: string): Promise<void> {
    const path = resolveVirtualPath(cwd, rawPath.trim());
    if (!path) {
      terminalLines = [...terminalLines, store.terminalLine('error', 'Invalid path: paths must stay inside the virtual workspace.')];
      return;
    }
    if (await store.getFile(activeProjectId, path)) {
      terminalLines = [...terminalLines, store.terminalLine('error', `File already exists: ${path}`)];
      return;
    }
    await store.putFile(store.makeFile(activeProjectId, path, '', 'file'));
    await auditDirectAction(`Create file ${path}`, { projectId: activeProjectId, path });
    activePath = null;
    await loadProjectState();
    await openFile(path);
    status = 'File created';
  }

  async function deleteFile(path: string): Promise<void> {
    await store.deleteFile(activeProjectId, path);
    if (activePath === path) {
      activePath = null;
      editorContent = '';
      dirty = false;
    }
    await auditDirectAction(`Delete file ${path}`, { projectId: activeProjectId, path });
    await loadProjectState();
    status = 'File deleted';
  }

  function askApproval(request: ApprovalRequest): Promise<boolean> {
    return new Promise((resolve) => {
      approvalResolver = resolve;
      approvalRequest = request;
      status = 'Awaiting approval';
    });
  }

  function resolveApproval(approved: boolean): void {
    const resolver = approvalResolver;
    approvalResolver = null;
    approvalRequest = null;
    resolver?.(approved);
  }

  async function runCommand(raw: string): Promise<void> {
    if (busy || !activeProjectId) return;
    busy = true;
    terminalLines = [...terminalLines, store.terminalLine('input', `guest@corebase:${cwd || '~'}$ ${raw}`)];
    terminalHistory = [...terminalHistory, raw];
    await persistSession();

    try {
      const result = await runLifecycleCommand(raw, {
        adapter: shellAdapter,
        projectId: activeProjectId,
        sessionId,
        actor: 'guest',
        cwd,
        approvalsEnabled: settings?.approvalsEnabled ?? true,
        onStage: (stage) => {
          status = stageLabels[stage];
        },
        requestApproval: askApproval,
      });

      if (result.clear) {
        terminalLines = [];
      } else {
        const additions: TerminalLine[] = [];
        if (result.stdout) {
          for (const text of result.stdout.split('\n')) additions.push(store.terminalLine('stdout', text));
        }
        if (result.stderr) {
          for (const text of result.stderr.split('\n')) additions.push(store.terminalLine('stderr', text));
        }
        const checks = result.verification.checks.map((check) => `${check.name}:${check.passed ? 'pass' : 'fail'}`).join(' · ');
        additions.push(
          store.terminalLine(
            result.ok ? 'success' : 'error',
            `${result.ok ? '✓ verified' : '✗ failed'} · exit ${result.exitCode} · ${checks} · audit #${result.trace.at(-1)?.seq ?? '?'}`,
          ),
        );
        terminalLines = [...terminalLines, ...additions];
      }
      status = result.ok ? 'Ready · verified' : result.status === 'denied' ? 'Denied' : 'Failed verification';
      await persistSession();
      await refreshAudit();
      await refreshGrants();
      await refreshCheckpoints();
      await loadProjectState();
    } finally {
      busy = false;
    }
  }

  async function clearTerminal(): Promise<void> {
    terminalLines = [];
    await persistSession();
  }

  async function handleRevoke(id: string): Promise<void> {
    const grant = grants.find((item) => item.id === id);
    await revokeGrant(id, 'guest', grant);
    await refreshGrants();
    await refreshAudit();
    status = 'Grant revoked';
  }

  async function handleCheckpoint(label: string): Promise<void> {
    await createUserCheckpoint(activeProjectId, label, 'guest');
    await refreshCheckpoints();
    await refreshAudit();
    status = 'Checkpoint saved';
  }

  async function handleRestore(checkpoint: Checkpoint): Promise<void> {
    await restoreUserCheckpoint(checkpoint, 'guest');
    activePath = null;
    await loadProjectState();
    await refreshCheckpoints();
    await refreshAudit();
    status = 'Checkpoint restored';
  }

  async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
    if (!settings) return;
    settings = { ...settings, ...patch };
    await store.putSettings(settings);
  }

  async function handleGenerate(): Promise<void> {
    const adapter = adapterById(settings?.activeModelAdapterId ?? 'offline-plan');
    try {
      lastPlan = await adapter.plan({ goal, projectId: activeProjectId });
      agentError = '';
    } catch (error) {
      lastPlan = null;
      agentError = error instanceof Error ? error.message : String(error);
    }
  }
</script>

<svelte:head>
  <title>CoreBase — local workspace</title>
  <meta name="description" content="A sandboxed, guest-owned local workspace with hash-chained audit and explicit permissions." />
</svelte:head>

{#if !ready}
  <div class="grid h-dvh place-items-center bg-ink-950 text-mist-100">
    <div class="flex items-center gap-3 text-sm text-mist-200/60">
      <LoaderCircle size={18} class="animate-spin text-accent-400" /> Preparing your local workspace…
    </div>
  </div>
{:else}
  <div class="flex h-dvh flex-col overflow-hidden bg-ink-950 text-mist-100">
    <Header
      projectName={activeProject?.name ?? 'No project'}
      {tab}
      {status}
      {chain}
      adapterName="Virtual shell"
      onMenu={() => (sidebarOpen = true)}
    />

    <div class="flex min-h-0 flex-1">
      {#if sidebarOpen}
        <button
          type="button"
          aria-label="Close navigation"
          class="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onclick={() => (sidebarOpen = false)}
        ></button>
      {/if}
      <Sidebar
        {projects}
        {activeProjectId}
        {files}
        {activePath}
        open={sidebarOpen}
        onSelectProject={(id) => {
          void selectProject(id);
          sidebarOpen = false;
        }}
        onOpenFile={(path) => {
          void openFile(path);
          sidebarOpen = false;
        }}
        onNewProject={() => {
          dialog = { kind: 'new-project' };
          sidebarOpen = false;
        }}
        onNewFile={() => {
          dialog = { kind: 'new-file' };
          sidebarOpen = false;
        }}
        onDeleteFile={(path) => (dialog = { kind: 'delete-file', path })}
        onClose={() => (sidebarOpen = false)}
      />

      <main class="flex min-w-0 flex-1 flex-col">
        <nav aria-label="Workspace sections" class="flex shrink-0 gap-1 overflow-x-auto border-b border-ink-800 bg-ink-900/50 px-2 sm:px-3">
          {#each tabs as item (item.id)}
            {@const Icon = item.icon}
            <button
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onclick={() => (tab = item.id)}
              class={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs transition-colors ${tab === item.id ? 'border-accent-500 text-accent-400' : 'border-transparent text-mist-200/50 hover:text-mist-100'}`}
            >
              <Icon size={14} /> {item.label}
              {#if item.id === 'audit' && !chain.ok}
                <span class="size-1.5 rounded-full bg-bad-400" aria-label="Chain break"></span>
              {/if}
            </button>
          {/each}
        </nav>

        <div class="min-h-0 flex-1" role="tabpanel">
          {#if tab === 'editor'}
            {#if EditorPanel}
              <EditorPanel
                file={activeFile}
                {dirty}
                onChange={(value) => {
                  editorContent = value;
                  dirty = true;
                }}
                onSave={() => void saveCurrentFile()}
                onDelete={() => {
                  if (activePath) dialog = { kind: 'delete-file', path: activePath };
                }}
              />
            {:else}
              <div class="grid h-full place-items-center text-sm text-mist-200/50">Loading editor…</div>
            {/if}
          {:else if tab === 'terminal'}
            <TerminalPanel
              lines={terminalLines}
              history={terminalHistory}
              {status}
              adapterName={shellAdapter.describe().name}
              {cwd}
              {busy}
              onRun={(command) => void runCommand(command)}
              onClear={() => void clearTerminal()}
            />
          {:else if tab === 'audit'}
            <AuditPanel entries={auditEntries} {chain} onRefresh={() => void refreshAudit()} />
          {:else if tab === 'agents'}
            <AgentsPanel
              adapters={adapterDescriptions}
              activeId={settings?.activeModelAdapterId ?? 'offline-plan'}
              {goal}
              plan={lastPlan}
              error={agentError}
              onGoalChange={(value) => (goal = value)}
              onSelect={(id) => void updateSettings({ activeModelAdapterId: id })}
              onGenerate={() => void handleGenerate()}
            />
          {:else}
            <SettingsPanel
              {grants}
              {checkpoints}
              settings={settings ?? fallbackSettings}
              {chain}
              onRevoke={(id) => void handleRevoke(id)}
              onSaveCheckpoint={(label) => void handleCheckpoint(label)}
              onRestoreCheckpoint={(checkpoint) => void handleRestore(checkpoint)}
              onUpdateSettings={(patch) => void updateSettings(patch)}
            />
          {/if}
        </div>
      </main>
    </div>

    {#if approvalRequest}
      <ApprovalDialog
        request={approvalRequest}
        onApprove={() => resolveApproval(true)}
        onDeny={() => resolveApproval(false)}
      />
    {/if}

    {#if dialog?.kind === 'new-project'}
      <ActionDialog
        title="New project"
        message="Create a separate local workspace in this browser."
        confirmLabel="Create project"
        valueLabel="Project name"
        placeholder="Research notes"
        onConfirm={(value) => {
          dialog = null;
          void createProject(value);
        }}
        onCancel={() => (dialog = null)}
      />
    {:else if dialog?.kind === 'new-file'}
      <ActionDialog
        title="New file"
        message="Paths are virtual and stay inside this workspace. Use .md or .js for language support."
        confirmLabel="Create file"
        valueLabel="File path"
        placeholder="notes/new-idea.md"
        onConfirm={(value) => {
          dialog = null;
          void createFile(value);
        }}
        onCancel={() => (dialog = null)}
      />
    {:else if dialog?.kind === 'delete-file'}
      <ActionDialog
        title="Delete file"
        message={`Delete ${dialog.path} from this local workspace? This change is recorded in the audit chain.`}
        confirmLabel="Delete file"
        danger={true}
        onConfirm={() => {
          const path = dialog && dialog.kind === 'delete-file' ? dialog.path : '';
          dialog = null;
          if (path) void deleteFile(path);
        }}
        onCancel={() => (dialog = null)}
      />
    {:else if dialog?.kind === 'checkpoint'}
      <ActionDialog
        title="Checkpoint"
        message="Save an immutable snapshot of this project."
        confirmLabel="Save"
        valueLabel="Label"
        onConfirm={(value) => {
          dialog = null;
          void handleCheckpoint(value);
        }}
        onCancel={() => (dialog = null)}
      />
    {/if}
  </div>
{/if}
