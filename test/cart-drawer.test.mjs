import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getCartDrawerSettings,
  saveCartDrawerSettings,
  getStickyCartSettings,
  saveStickyCartSettings,
} from '../app/db.server.ts';

const rootDir = process.cwd();

describe('Cart Drawer Settings & Backend Separation', () => {
  it('manages cart drawer settings independently from sticky cart settings', () => {
    const shop = 'drawer-test-store.myshopify.com';

    const defaultDrawer = getCartDrawerSettings(shop);
    assert.equal(defaultDrawer.enabled, true);
    assert.equal(defaultDrawer.freeShippingThreshold, 50);
    assert.equal(defaultDrawer.freeShippingBarColor, '#008060');
    assert.equal(defaultDrawer.addonEnabled, true);

    const defaultSticky = getStickyCartSettings(shop);
    assert.equal(defaultSticky.buttonText, 'Add to Cart');

    // Update Drawer settings
    const updatedDrawer = saveCartDrawerSettings(shop, {
      freeShippingThreshold: 75,
      freeShippingBarColor: '#10b981',
      checkoutButtonText: 'Secure Checkout Now',
    });

    assert.equal(updatedDrawer.freeShippingThreshold, 75);
    assert.equal(updatedDrawer.freeShippingBarColor, '#10b981');
    assert.equal(updatedDrawer.checkoutButtonText, 'Secure Checkout Now');

    // Verify Sticky settings remained completely untouched
    const stickyAfter = getStickyCartSettings(shop);
    assert.equal(stickyAfter.buttonText, 'Add to Cart');

    // Update Sticky settings
    saveStickyCartSettings(shop, { buttonText: 'Grab Deal Now' });

    // Verify Drawer settings were not affected by Sticky update
    const drawerReloaded = getCartDrawerSettings(shop);
    assert.equal(drawerReloaded.freeShippingThreshold, 75);
    assert.equal(drawerReloaded.checkoutButtonText, 'Secure Checkout Now');
  });

  it('correctly calculates free shipping progress and remaining amounts', () => {
    const threshold = 50;

    // Subtotal: $20.00
    const cartSubtotal1 = 20.0;
    const percent1 = Math.min(100, Math.round((cartSubtotal1 / threshold) * 100));
    const remaining1 = Math.max(0, threshold - cartSubtotal1);
    assert.equal(percent1, 40);
    assert.equal(remaining1, 30.0);

    // Subtotal: $50.00 (exact threshold)
    const cartSubtotal2 = 50.0;
    const percent2 = Math.min(100, Math.round((cartSubtotal2 / threshold) * 100));
    const remaining2 = Math.max(0, threshold - cartSubtotal2);
    assert.equal(percent2, 100);
    assert.equal(remaining2, 0);

    // Subtotal: $75.00 (surpassed threshold)
    const cartSubtotal3 = 75.0;
    const percent3 = Math.min(100, Math.round((cartSubtotal3 / threshold) * 100));
    const remaining3 = Math.max(0, threshold - cartSubtotal3);
    assert.equal(percent3, 100);
    assert.equal(remaining3, 0);
  });
});

describe('Cart Drawer Storefront Theme App Extension Structure', () => {
  it('blocks/cart-drawer-embed.liquid exists and has clean schema with settings managed via app', () => {
    const filePath = path.join(rootDir, 'extensions/totalbundle-theme-ext/blocks/cart-drawer-embed.liquid');
    assert.ok(fs.existsSync(filePath), 'cart-drawer-embed.liquid must exist');

    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('{% render \'cart-drawer-component\''), 'Must render cart-drawer-component');

    const schemaMatch = content.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
    assert.ok(schemaMatch, 'Schema tag must be present');

    const schema = JSON.parse(schemaMatch[1]);
    assert.equal(schema.name, 'Cart Drawer');
    assert.equal(schema.target, 'body');
    assert.equal(schema.javascript, 'cart-drawer.js');
    assert.equal(schema.stylesheet, 'cart-drawer.css');
    assert.ok(Array.isArray(schema.settings));
    assert.equal(schema.settings.length, 0);
  });

  it('snippets/cart-drawer-component.liquid renders free shipping bar, addons, and theme styles', () => {
    const filePath = path.join(rootDir, 'extensions/totalbundle-theme-ext/snippets/cart-drawer-component.liquid');
    assert.ok(fs.existsSync(filePath), 'cart-drawer-component.liquid must exist');

    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('tb-free-shipping-section'), 'Must have free shipping bar container');
    assert.ok(content.includes('tb-free-shipping-fill'), 'Must have free shipping fill bar');
    assert.ok(content.includes('tb-drawer-addons'), 'Must have product addons container');
    assert.ok(content.includes('tb-addon-add-btn'), 'Must have addon button');
    assert.ok(content.includes('tb-drawer-checkout-btn'), 'Must have checkout button');
    assert.ok(content.includes('app.metafields.cart_drawer.settings.value'), 'Must read cart_drawer metafield');
  });

  it('assets/cart-drawer.css contains responsive styles and suppresses native theme drawers', () => {
    const filePath = path.join(rootDir, 'extensions/totalbundle-theme-ext/assets/cart-drawer.css');
    assert.ok(fs.existsSync(filePath), 'cart-drawer.css must exist');

    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('var(--font-body-family'), 'Must inherit theme body font');
    assert.ok(content.includes('var(--font-heading-family'), 'Must inherit theme heading font');
    assert.ok(content.includes('@media (max-width: 640px)'), 'Must include mobile responsive rules');
    assert.ok(content.includes('.tb-cart-drawer'), 'Must define cart drawer class');
    assert.ok(content.includes('cart-drawer'), 'Must suppress theme cart-drawer');
    assert.ok(content.includes('cart-notification'), 'Must suppress theme cart-notification');
  });

  it('assets/cart-drawer.js contains ajax cart, free shipping, and theme drawer suppressors', () => {
    const filePath = path.join(rootDir, 'extensions/totalbundle-theme-ext/assets/cart-drawer.js');
    assert.ok(fs.existsSync(filePath), 'cart-drawer.js must exist');

    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('/cart.js'), 'Must fetch cart via /cart.js');
    assert.ok(content.includes('/cart/change.js'), 'Must update items via /cart/change.js');
    assert.ok(content.includes('/cart/add.js'), 'Must add addons via /cart/add.js');
    assert.ok(content.includes('totalbundle:open-cart-drawer'), 'Must listen to open drawer event');
    assert.ok(content.includes('suppressThemeDrawer'), 'Must have suppressThemeDrawer method');
    assert.ok(content.includes('hijackThemeProductForms'), 'Must hijack Dawn product forms');
    assert.ok(content.includes('proxyCart'), 'Must provide proxy cart to stop /cart redirect');
    assert.ok(content.includes('MutationObserver'), 'Must have MutationObserver to prevent theme drawer flashes');
    assert.ok(content.includes('stopImmediatePropagation'), 'Must stop theme bubble listeners');
  });

  it('blocks/sticky-cart-embed.liquid renders cart-drawer-component to ensure drawer is loaded globally', () => {
    const filePath = path.join(rootDir, 'extensions/totalbundle-theme-ext/blocks/sticky-cart-embed.liquid');
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('{% render \'cart-drawer-component\''), 'Must render cart-drawer-component in main embed');
  });

  it('app/routes/api.cart-drawer-settings.ts exists for public API', () => {
    const filePath = path.join(rootDir, 'app/routes/api.cart-drawer-settings.ts');
    assert.ok(fs.existsSync(filePath), 'api.cart-drawer-settings.ts must exist');
  });
});

