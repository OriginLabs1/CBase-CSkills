<script lang="ts">
  import type { Diagnostic } from '@oneorigin/contracts';

  let { severity }: { severity: Diagnostic['severity'] } = $props();

  const styles: Record<Diagnostic['severity'], string> = {
    error: 'bg-bad-400/15 text-bad-400 ring-bad-400/30',
    warning: 'bg-warn-400/15 text-warn-400 ring-warn-400/30',
    info: 'bg-accent-400/15 text-accent-400 ring-accent-400/30'
  };
</script>

<span
  class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset {styles[
    severity
  ]}"
>
  {severity}
</span>
