/**
 * Interchangeable email delivery. The service never logs codes: test adapters
 * keep them in memory only, and production operators supply their own sender.
 */

export class MemoryEmailSender {
  constructor() {
    this.messages = [];
  }

  async send(message) {
    this.messages.push({ ...message, at: new Date().toISOString() });
  }

  lastCode(challengeId) {
    return this.messages.find((message) => message.challengeId === challengeId)?.code;
  }
}

/** POSTs to an operator-controlled relay (for example a Cloudflare Worker). */
export class WebhookEmailSender {
  constructor(url, headers = {}) {
    if (!/^https?:\/\//.test(url)) throw new Error('Email webhook must be an http(s) URL.');
    this.url = url;
    this.headers = headers;
  }

  async send(message) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...this.headers },
      body: JSON.stringify(message),
    });
    if (!response.ok) throw new Error(`Email relay returned ${response.status}.`);
  }
}

/** Refuses to send; used when the operator has not configured delivery. */
export class NoopEmailSender {
  async send() {}
}
