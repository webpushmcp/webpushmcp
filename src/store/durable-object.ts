import { DurableObject } from "cloudflare:workers";

export interface Subscription {
  clientId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}

export class PushSubscriptionStore extends DurableObject {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    
    // Initialize schema
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          client_id TEXT PRIMARY KEY,
          endpoint TEXT NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
    });
  }

  async saveSubscription(clientId: string, endpoint: string, p256dh: string, auth: string): Promise<void> {
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO subscriptions (client_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)`,
      clientId, endpoint, p256dh, auth
    );
  }

  async getSubscription(clientId: string): Promise<Subscription | null> {
    const result = this.ctx.storage.sql.exec(
      `SELECT * FROM subscriptions WHERE client_id = ?`,
      clientId
    );
    const rows = [...result];
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      clientId: row.client_id as string,
      endpoint: row.endpoint as string,
      p256dh: row.p256dh as string,
      auth: row.auth as string,
      createdAt: row.created_at as string
    };
  }

  async listSubscriptions(): Promise<Subscription[]> {
    const result = this.ctx.storage.sql.exec(`SELECT * FROM subscriptions ORDER BY created_at ASC`);
    return [...result].map(row => ({
      clientId: row.client_id as string,
      endpoint: row.endpoint as string,
      p256dh: row.p256dh as string,
      auth: row.auth as string,
      createdAt: row.created_at as string
    }));
  }

  async deleteSubscription(clientId: string): Promise<boolean> {
    const result = this.ctx.storage.sql.exec(`DELETE FROM subscriptions WHERE client_id = ?`, clientId);
    return result.rowsWritten > 0;
  }
}
