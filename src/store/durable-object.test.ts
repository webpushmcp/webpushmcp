import { env, createExecutionContext, waitOnExecutionContext, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";

describe("PushSubscriptionStore Durable Object", () => {
  it("should save and retrieve a subscription", async () => {
    const id = env.PUSH_STORE.idFromName("test");
    const stub = env.PUSH_STORE.get(id);

    const subscription = {
      clientId: "test-client-1",
      endpoint: "https://fcm.googleapis.com/fcm/send/123",
      p256dh: "p256dh-key",
      auth: "auth-secret"
    };

    await stub.saveSubscription(
      subscription.clientId,
      subscription.endpoint,
      subscription.p256dh,
      subscription.auth
    );

    const retrieved = await stub.getSubscription(subscription.clientId);
    expect(retrieved).toMatchObject(subscription);
  });

  it("should list all subscriptions", async () => {
    const id = env.PUSH_STORE.idFromName("test-list");
    const stub = env.PUSH_STORE.get(id);

    await stub.saveSubscription("c1", "e1", "p1", "a1");
    await stub.saveSubscription("c2", "e2", "p2", "a2");

    const list = await stub.listSubscriptions();
    expect(list).toHaveLength(2);
    expect(list[0].clientId).toBe("c1");
    expect(list[1].clientId).toBe("c2");
  });

  it("should delete a subscription", async () => {
    const id = env.PUSH_STORE.idFromName("test-delete");
    const stub = env.PUSH_STORE.get(id);

    await stub.saveSubscription("del", "e", "p", "a");
    const before = await stub.getSubscription("del");
    expect(before).not.toBeNull();

    const deleted = await stub.deleteSubscription("del");
    expect(deleted).toBe(true);

    const after = await stub.getSubscription("del");
    expect(after).toBeNull();
  });
});
