import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface StoredSubscription {
  userId: string;
  subscription: PushSubscriptionData;
  subscribedAt: string;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  /**
   * In-memory store for push subscriptions.
   * In production, migrate to a dedicated DB table.
   */
  private subscriptions: Map<string, StoredSubscription[]> = new Map();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    let publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    let privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys not found in environment. Generating ephemeral keys for development. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in production.',
      );
      const keys = webpush.generateVAPIDKeys();
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
      this.logger.log(`Generated VAPID public key: ${publicKey}`);
    }

    webpush.setVapidDetails(
      'mailto:admin@exeteam.fr',
      publicKey,
      privateKey,
    );
  }

  getPublicKey(): string {
    return this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
  }

  subscribe(userId: string, subscription: PushSubscriptionData) {
    const existing = this.subscriptions.get(userId) ?? [];
    // Avoid duplicate endpoints
    const filtered = existing.filter((s) => s.subscription.endpoint !== subscription.endpoint);
    filtered.push({ userId, subscription, subscribedAt: new Date().toISOString() });
    this.subscriptions.set(userId, filtered);
    return { success: true };
  }

  unsubscribe(userId: string, endpoint: string) {
    const existing = this.subscriptions.get(userId) ?? [];
    this.subscriptions.set(
      userId,
      existing.filter((s) => s.subscription.endpoint !== endpoint),
    );
    return { success: true };
  }

  async sendToUser(userId: string, payload: { title: string; body?: string; link?: string }) {
    const userSubs = this.subscriptions.get(userId) ?? [];
    const results = await Promise.allSettled(
      userSubs.map((stored) =>
        webpush.sendNotification(
          stored.subscription as webpush.PushSubscription,
          JSON.stringify(payload),
        ),
      ),
    );

    // Remove expired subscriptions (410 Gone)
    const toRemove: string[] = [];
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const err = result.reason as { statusCode?: number };
        if (err.statusCode === 410) {
          toRemove.push(userSubs[idx].subscription.endpoint);
        }
      }
    });

    if (toRemove.length > 0) {
      const remaining = (this.subscriptions.get(userId) ?? []).filter(
        (s) => !toRemove.includes(s.subscription.endpoint),
      );
      this.subscriptions.set(userId, remaining);
    }

    return { sent: results.filter((r) => r.status === 'fulfilled').length };
  }
}
