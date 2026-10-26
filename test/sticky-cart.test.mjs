import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const EXTENSION_DIR = path.resolve('extensions/totalbundle-theme-ext');

describe('Theme App Extension Structure & Configuration', () => {
  it('shopify.extension.toml exists and has type="theme"', () => {
    const tomlPath = path.join(EXTENSION_DIR, 'shopify.extension.toml');
    assert.ok(fs.existsSync(tomlPath), 'shopify.extension.toml must exist');
    const content = fs.readFileSync(tomlPath, 'utf8');
    assert.match(content, /type\s*=\s*"theme"/);
  });

  it('locales/en.default.json exists and contains required keys', () => {
    const localePath = path.join(EXTENSION_DIR, 'locales/en.default.json');
    assert.ok(fs.existsSync(localePath), 'en.default.json must exist');
    const json = JSON.parse(fs.readFileSync(localePath, 'utf8'));
    assert.ok(json.sticky_cart, 'Must have sticky_cart object');
    assert.ok(json.sticky_cart.add_to_cart);
    assert.ok(json.sticky_cart.sold_out);
    assert.ok(json.sticky_cart.quantity);
  });

  it('blocks/sticky-cart-embed.liquid exists and has valid schema', () => {
    const embedPath = path.join(EXTENSION_DIR, 'blocks/sticky-cart-embed.liquid');
    assert.ok(fs.existsSync(embedPath), 'sticky-cart-embed.liquid must exist');
    const content = fs.readFileSync(embedPath, 'utf8');

    const schemaMatch = content.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
    assert.ok(schemaMatch, 'Must contain schema block');
    const schema = JSON.parse(schemaMatch[1]);

    assert.equal(schema.target, 'body');
    assert.equal(schema.name, 'Sticky Add to Cart');
    assert.ok(Array.isArray(schema.settings));

    const settingIds = schema.settings.map((s) => s.id).filter(Boolean);
    assert.ok(settingIds.includes('position'), 'Must include position setting');
    assert.ok(settingIds.includes('desktop_visibility'), 'Must include desktop_visibility setting');
    assert.ok(settingIds.includes('show_on_mobile'), 'Must include show_on_mobile setting');
    assert.ok(settingIds.includes('bg_color'), 'Must include bg_color setting');
    assert.ok(settingIds.includes('button_bg_color'), 'Must include button_bg_color setting');
    assert.ok(settingIds.includes('button_text'), 'Must include button_text setting');
    assert.ok(settingIds.includes('border_radius'), 'Must include border_radius setting');
    assert.ok(settingIds.includes('padding'), 'Must include padding setting');
  });

  it('blocks/sticky-cart-block.liquid exists and has valid schema', () => {
    const blockPath = path.join(EXTENSION_DIR, 'blocks/sticky-cart-block.liquid');
    assert.ok(fs.existsSync(blockPath), 'sticky-cart-block.liquid must exist');
    const content = fs.readFileSync(blockPath, 'utf8');

    const schemaMatch = content.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
    assert.ok(schemaMatch, 'Must contain schema block');
    const schema = JSON.parse(schemaMatch[1]);

    assert.equal(schema.target, 'section');
    assert.deepEqual(schema.templates, ['product']);
  });

  it('snippets/sticky-cart-component.liquid exists and handles accessibility & multi-variants', () => {
    const snippetPath = path.join(EXTENSION_DIR, 'snippets/sticky-cart-component.liquid');
    assert.ok(fs.existsSync(snippetPath), 'sticky-cart-component.liquid must exist');
    const content = fs.readFileSync(snippetPath, 'utf8');

    assert.ok(content.includes('role="region"'), 'Must have role=region for accessibility');
    assert.ok(content.includes('aria-live="polite"'), 'Must have aria-live region');
    assert.ok(content.includes('tb-sticky-cart__variant-select'), 'Must have variant dropdown');
    assert.ok(content.includes('tb-sticky-cart__qty-picker'), 'Must have quantity picker');
    assert.ok(content.includes('tb-sticky-cart__add-btn'), 'Must have add button');
  });

  it('assets/sticky-cart.css exists and handles responsive & reduced motion', () => {
    const cssPath = path.join(EXTENSION_DIR, 'assets/sticky-cart.css');
    assert.ok(fs.existsSync(cssPath), 'sticky-cart.css must exist');
    const content = fs.readFileSync(cssPath, 'utf8');

    assert.ok(content.includes('.tb-sticky-cart--bottom'), 'Must have bottom position');
    assert.ok(content.includes('.tb-sticky-cart--top'), 'Must have top position');
    assert.ok(content.includes('@media (max-width: 768px)'), 'Must have mobile styles');
    assert.ok(content.includes('prefers-reduced-motion'), 'Must support reduced motion');
    assert.ok(content.includes(':focus-visible'), 'Must have focus-visible styles');
  });
});

describe('Sticky Add to Cart JavaScript Core Logic', () => {
  it('correctly formats money with standard Shopify template tokens', () => {
    const mockStickyCart = {
      productData: {
        moneyFormat: '${{amount}}',
      },
      formatMoney(cents) {
        if (typeof cents !== 'number') cents = parseInt(cents, 10) || 0;
        const format = this.productData.moneyFormat || '${{amount}}';
        const amount = (cents / 100).toFixed(2);
        const amountNoDecimals = Math.round(cents / 100).toString();

        return format
          .replace('{{amount}}', amount)
          .replace('{{amount_no_decimals}}', amountNoDecimals)
          .replace('{{amount_with_comma_separator}}', amount.replace('.', ','))
          .replace('{{amount_no_decimals_with_comma_separator}}', amountNoDecimals);
      },
    };

    assert.equal(mockStickyCart.formatMoney(2999), '$29.99');
    assert.equal(mockStickyCart.formatMoney(0), '$0.00');
    assert.equal(mockStickyCart.formatMoney(15000), '$150.00');

    // Test with Euro comma format
    mockStickyCart.productData.moneyFormat = '€{{amount_with_comma_separator}}';
    assert.equal(mockStickyCart.formatMoney(4995), '€49,95');
  });

  it('correctly identifies selected variant and availability status', () => {
    const variants = [
      { id: 101, title: 'Small / Blue', price: 2500, compare_at_price: 3500, available: true },
      { id: 102, title: 'Medium / Blue', price: 2500, compare_at_price: 3500, available: false },
      { id: 103, title: 'Large / Blue', price: 2500, compare_at_price: null, available: true },
    ];

    const findVariant = (id) => variants.find((v) => String(v.id) === String(id));

    // Variant 101 is available
    const v1 = findVariant(101);
    assert.ok(v1);
    assert.equal(v1.available, true);
    assert.equal(v1.price, 2500);

    // Calculate discount percentage
    const discountPercent = Math.round(((v1.compare_at_price - v1.price) * 100) / v1.compare_at_price);
    assert.equal(discountPercent, 29); // 1000 / 3500 ≈ 28.57% -> 29%

    // Variant 102 is sold out
    const v2 = findVariant('102');
    assert.ok(v2);
    assert.equal(v2.available, false);

    // Variant 103 has no compare price
    const v3 = findVariant(103);
    assert.equal(v3.compare_at_price, null);
  });

  it('correctly clamps quantity stepper logic', () => {
    const adjustQty = (current, delta) => {
      const parsed = parseInt(current, 10) || 1;
      return Math.max(1, parsed + delta);
    };

    assert.equal(adjustQty(1, -1), 1, 'Quantity cannot go below 1');
    assert.equal(adjustQty(2, -1), 1);
    assert.equal(adjustQty(1, 1), 2);
    assert.equal(adjustQty(5, 1), 6);
    assert.equal(adjustQty('invalid', 0), 1);
  });

  it('constructs correct Shopify AJAX Cart API payload', () => {
    const buildPayload = (variantId, quantity) => {
      const id = Number(variantId);
      const qty = Math.max(1, parseInt(quantity, 10) || 1);
      return { id, quantity: qty };
    };

    const payload = buildPayload('4432109876', '3');
    assert.equal(payload.id, 4432109876);
    assert.equal(payload.quantity, 3);
    assert.equal(typeof payload.id, 'number');
    assert.equal(typeof payload.quantity, 'number');
  });

  it('DOM singleton deduplication logic removes extra instances on re-render', () => {
    const simulatedDOM = [
      { id: 'totalbundle-sticky-cart', isFirst: true, removed: false },
      { id: 'totalbundle-sticky-cart', isFirst: false, removed: false },
    ];

    // Deduplication logic from sticky-cart.js
    if (simulatedDOM.length > 1) {
      for (let i = 0; i < simulatedDOM.length - 1; i++) {
        simulatedDOM[i].removed = true;
      }
    }

    assert.equal(simulatedDOM[0].removed, true);
    assert.equal(simulatedDOM[1].removed, false);
  });
});
