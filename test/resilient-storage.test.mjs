import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '@shopify/shopify-api';
import { createResilientSessionStorage } from '../app/session-storage.server.ts';
import { getStickyCartSettings, saveStickyCartSettings } from '../app/db.server.ts';

describe('Resilient Session Storage & Sticky Cart Settings', () => {
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

  it('manages sticky cart settings per shop with safe defaults and persistence', () => {
    const defaults = getStickyCartSettings('new-store.myshopify.com');
    assert.equal(defaults.enabled, true);
    assert.equal(defaults.position, 'bottom');
    assert.equal(defaults.buttonText, 'Add to Cart');

    const updated = saveStickyCartSettings('new-store.myshopify.com', {
      buttonText: 'Buy Now With 1-Click',
      position: 'top',
      buttonBgColor: '#2563eb',
    });

    assert.equal(updated.buttonText, 'Buy Now With 1-Click');
    assert.equal(updated.position, 'top');
    assert.equal(updated.buttonBgColor, '#2563eb');

    const reloaded = getStickyCartSettings('new-store.myshopify.com');
    assert.equal(reloaded.buttonText, 'Buy Now With 1-Click');
  });
});
