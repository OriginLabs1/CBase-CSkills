<script lang="ts">
  import {
    ChevronRight,
    FilePlus,
    FileText,
    Folder,
    FolderOpen,
    FolderPlus,
    HardDrive,
    Trash,
    X,
  } from '@lucide/svelte';
  import { buildFileTree, type TreeRow } from '../helpers';
  import type { Project, VirtualFile } from '../types';

  interface Props {
    projects: Project[];
    activeProjectId: string;
    files: VirtualFile[];
    activePath: string | null;
    open: boolean;
    onSelectProject: (id: string) => void;
    onOpenFile: (path: string) => void;
    onNewProject: () => void;
    onNewFile: () => void;
    onDeleteFile: (path: string) => void;
    onClose: () => void;
  }

  let {
    projects,
    activeProjectId,
    files,
    activePath,
    open,
    onSelectProject,
    onOpenFile,
    onNewProject,
    onNewFile,
    onDeleteFile,
    onClose,
  }: Props = $props();

  let collapsed = $state<Set<string>>(new Set());

  function toggle(path: string): void {
    const next = new Set(collapsed);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    collapsed = next;
  }

  function rowsFor(nodes: ReturnType<typeof buildFileTree>, depth: number): TreeRow[] {
    return nodes.flatMap((node) => {
      const row = { node, depth };
      if (node.isDirectory && collapsed.has(node.path)) return [row];
      return [row, ...rowsFor(node.children, depth + 1)];
    });
  }

  let tree = $derived(
    buildFileTree(
      files
        .filter((file) => file.projectId === activeProjectId)
        .map((file) => ({ path: file.path, kind: file.kind })),
    ),
  );
  let rows = $derived(rowsFor(tree, 0));
  let project = $derived(projects.find((item) => item.id === activeProjectId));
</script>

<aside
  aria-label="Workspace navigation"
  class={`fixed inset-y-0 left-0 z-30 flex w-[17rem] flex-col border-r border-ink-700/70 bg-ink-900 transition-transform duration-200 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
>
  <div class="flex h-14 shrink-0 items-center justify-between border-b border-ink-700/70 px-4 lg:hidden">
    <span class="text-sm font-semibold">Workspace</span>
    <button type="button" aria-label="Close navigation" onclick={onClose} class="rounded-lg p-1.5 hover:bg-ink-800">
      <X size={16} />
    </button>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto px-3 py-4">
    <section>
      <div class="mb-2 flex items-center justify-between px-1">
        <h2 class="text-[11px] font-semibold uppercase tracking-widest text-mist-200/40">Projects</h2>
        <button
          type="button"
          aria-label="New project"
          title="New project"
          onclick={onNewProject}
          class="rounded-md p-1 text-mist-200/60 hover:bg-ink-800 hover:text-accent-400"
        >
          <FolderPlus size={15} />
        </button>
      </div>
      <ul class="space-y-1">
        {#each projects as item (item.id)}
          <li>
            <button
              type="button"
              aria-current={item.id === activeProjectId ? 'page' : undefined}
              onclick={() => onSelectProject(item.id)}
              class={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${item.id === activeProjectId ? 'bg-accent-500/10 text-accent-400' : 'text-mist-200/75 hover:bg-ink-800'}`}
            >
              <Folder size={15} class="shrink-0" />
              <span class="truncate">{item.name}</span>
            </button>
          </li>
        {:else}
          <li class="rounded-lg border border-dashed border-ink-700 px-3 py-4 text-center text-xs text-mist-200/40">
            No projects yet
          </li>
        {/each}
      </ul>
    </section>

    <section class="mt-6">
      <div class="mb-2 flex items-center justify-between px-1">
        <h2 class="text-[11px] font-semibold uppercase tracking-widest text-mist-200/40">Files</h2>
        <button
          type="button"
          aria-label="New file"
          title="New file"
          onclick={onNewFile}
          class="rounded-md p-1 text-mist-200/60 hover:bg-ink-800 hover:text-accent-400"
        >
          <FilePlus size={15} />
        </button>
      </div>
      {#if project}
        <p class="mb-2 truncate px-2 text-[11px] text-mist-200/35">{project.description}</p>
      {/if}
      <ul class="space-y-0.5">
        {#each rows as row (row.node.path)}
          {@const node = row.node}
          <li>
            <div
              class={`group flex items-center rounded-lg pr-1 transition-colors ${node.path === activePath ? 'bg-accent-500/10 text-accent-400' : 'text-mist-200/70 hover:bg-ink-800'}`}
              style={`padding-left: ${row.depth * 12 + 6}px`}
            >
              {#if node.isDirectory}
                <button
                  type="button"
                  aria-label={`${collapsed.has(node.path) ? 'Expand' : 'Collapse'} ${node.name}`}
                  onclick={() => toggle(node.path)}
                  class="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-sm"
                >
                  <ChevronRight size={13} class={`shrink-0 transition-transform ${collapsed.has(node.path) ? '' : 'rotate-90'}`} />
                  {#if collapsed.has(node.path)}<Folder size={14} class="shrink-0" />{:else}<FolderOpen size={14} class="shrink-0" />{/if}
                  <span class="truncate">{node.name}</span>
                </button>
              {:else}
                <button
                  type="button"
                  aria-label={`Open ${node.path}`}
                  onclick={() => onOpenFile(node.path)}
                  class="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-4 text-left text-sm"
                >
                  <FileText size={14} class="shrink-0 opacity-70" />
                  <span class="truncate">{node.name}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${node.path}`}
                  title="Delete file"
                  onclick={() => onDeleteFile(node.path)}
                  class="rounded-md p-1 text-mist-200/25 opacity-0 transition-opacity hover:text-bad-400 focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash size={13} />
                </button>
              {/if}
            </div>
          </li>
        {:else}
          <li class="rounded-lg border border-dashed border-ink-700 px-3 py-4 text-center text-xs text-mist-200/40">
            No files in this project
          </li>
        {/each}
      </ul>
    </section>
  </div>

  <div class="shrink-0 border-t border-ink-700/70 px-4 py-3 text-[11px] text-mist-200/35">
    <span class="flex items-center gap-1.5"><HardDrive size={12} /> Local IndexedDB · guest owned</span>
  </div>
</aside>
