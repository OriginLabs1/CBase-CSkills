import { createService } from './http.mjs';
import { MemoryEmailSender, NoopEmailSender, WebhookEmailSender } from './email.mjs';
import { MemoryPersistenceAdapter } from '@oneorigin/persistence';

const port = Number(process.env.SERVICE_PORT ?? 8787);
const host = process.env.SERVICE_HOST ?? '0.0.0.0';
const secureCookies = process.env.SERVICE_SECURE_COOKIES === 'true';
const adapterKind = process.env.SERVICE_STORE ?? 'memory';

if (!['memory', 'oneorigin-postgresql', 'independent-postgresql'].includes(adapterKind)) {
  throw new Error('SERVICE_STORE must be memory, oneorigin-postgresql or independent-postgresql.');
}

// PostgreSQL deployments inject a PersistenceAdapter implementation here; the
// adapter contract and all record shapes remain identical to memory/edge stores.
const adapter = new MemoryPersistenceAdapter('service', adapterKind === 'memory' ? 'edge-local' : adapterKind);

const emailMode = process.env.EMAIL_ADAPTER ?? 'noop';
const emailSender = emailMode === 'memory'
  ? new MemoryEmailSender()
  : emailMode === 'webhook'
    ? new WebhookEmailSender(process.env.EMAIL_WEBHOOK_URL ?? '', {
      authorization: process.env.EMAIL_WEBHOOK_TOKEN ? `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN}` : undefined,
    })
    : new NoopEmailSender();

const service = createService({ adapter, emailSender, secureCookies });
await service.listen(port, host);
console.log(`OneOrigin service 0.0.2 listening on http://${host}:${port}`);
console.log(`Email adapter: ${emailMode} · Store kind: ${adapter.kind}`);
