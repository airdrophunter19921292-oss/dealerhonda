export class WebhookClient {
  constructor(supabaseUrl, serviceKey, webhookSecret) {
    this.webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
    this.serviceKey = serviceKey;
    this.webhookSecret = webhookSecret;
  }

  async postEvent(event, connectionId, extra = {}) {
    const body = { event, connection_id: connectionId, ...extra };
    try {
      const resp = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.serviceKey}`,
          ...(this.webhookSecret ? { 'X-Webhook-Secret': this.webhookSecret } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        console.error(`[webhook] Event "${event}" failed: ${resp.status}`);
      }
    } catch (err) {
      console.error(`[webhook] Event "${event}" error:`, err.message);
    }
  }
}
