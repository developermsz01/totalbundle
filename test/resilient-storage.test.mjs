import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '@shopify/shopify-api';
import { createResilientSessionStorage } from '../app/session-storage.server.ts';
import db from '../app/db.server.ts';

describe('Resilient Session Storage & Database Fallback', () => {
  it('stores and retrieves sessions from memory store without crashing when DB is offline', async () => {
    const storage = createResilientSessionStorage(null);

    const session = new Session({
      id: 'offline_test_store.myshopify.com_123',
      shop: 'test_store.myshopify.com',
      state: 'valid_state_456',
      isOnline: false,
      accessToken: 'shpat_abcdef123456',
    });

    const stored = await storage.storeSession(session);
    assert.equal(stored, true, 'Must successfully store session');

    const loaded = await storage.loadSession(session.id);
    assert.ok(loaded, 'Must find session');
    assert.equal(loaded.id, session.id);
    assert.equal(loaded.shop, session.shop);
    assert.equal(loaded.accessToken, 'shpat_abcdef123456');

    const byShop = await storage.findSessionsByShop('test_store.myshopify.com');
    assert.ok(byShop.length >= 1, 'Must find session by shop');
    assert.equal(byShop[0].shop, 'test_store.myshopify.com');
  });

  it('db.server safely returns bundles without crashing when DATABASE_URL is not configured', async () => {
    const bundles = await db.bundle.findMany();
    assert.ok(Array.isArray(bundles), 'Bundles must be an array');
    assert.ok(bundles.length >= 1, 'Should have pre-seeded sample bundles');

    const created = await db.bundle.create({
      data: {
        shop: 'demo.myshopify.com',
        title: 'Flash Sale BOGO',
        discountType: 'PERCENTAGE',
        discountValue: 25,
        minQuantity: 2,
      },
    });

    assert.ok(created.id, 'Created bundle must have an id');
    assert.equal(created.title, 'Flash Sale BOGO');

    const found = await db.bundle.findUnique({ where: { id: created.id } });
    assert.equal(found.id, created.id);
  });
});
