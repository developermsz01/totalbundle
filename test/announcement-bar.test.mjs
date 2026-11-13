import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAnnouncementBarSettings,
  saveAnnouncementBarSettings,
  defaultAnnouncementBarSettings,
} from '../app/db.server.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Announcement Bar Settings & Separation', () => {
  it('manages announcement bar settings independently from cart drawer and sticky cart', () => {
    const shop = 'announcement-test-store.myshopify.com';
    const initial = getAnnouncementBarSettings(shop);

    assert.equal(initial.enabled, true);
    assert.equal(initial.mode, 'rotating');
    assert.equal(initial.messages.length >= 1, true);

    const updated = saveAnnouncementBarSettings(shop, {
      mode: 'marquee',
      bgColor: '#ff0000',
      textColor: '#000000',
      marqueeSpeed: 30,
      messages: [
        { id: 'custom-1', text: 'Flash Sale: 50% Off Everything!', link: '/collections/sale' },
      ],
    });

    assert.equal(updated.mode, 'marquee');
    assert.equal(updated.bgColor, '#ff0000');
    assert.equal(updated.textColor, '#000000');
    assert.equal(updated.marqueeSpeed, 30);
    assert.equal(updated.messages[0].text, 'Flash Sale: 50% Off Everything!');

    // Fresh retrieval confirms persistence
    const retrieved = getAnnouncementBarSettings(shop);
    assert.equal(retrieved.mode, 'marquee');
    assert.equal(retrieved.messages[0].link, '/collections/sale');
  });
});

describe('Announcement Bar Storefront Theme App Extension Structure', () => {
  it('blocks/announcement-bar-embed.liquid exists and has clean schema with settings: []', () => {
    const filePath = path.join(rootDir, 'extensions/totalbundle-theme-ext/blocks/announcement-bar-embed.liquid');
    assert.ok(fs.existsSync(filePath), 'announcement-bar-embed.liquid must exist');

    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('announcement-bar-component'), 'Must render announcement-bar-component');
    assert.ok(content.includes('"target": "body"'), 'Must target body');
    assert.ok(content.includes('"settings": []'), 'Must have zero customizer clutter (settings: [])');
  });

  it('snippets/announcement-bar-component.liquid renders multi-mode (marquee, rotating, static)', () => {
    const filePath = path.join(rootDir, 'extensions/totalbundle-theme-ext/snippets/announcement-bar-component.liquid');
    assert.ok(fs.existsSync(filePath), 'announcement-bar-component.liquid must exist');

    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('tb-marquee-track'), 'Must support marquee scrolling ticker');
    assert.ok(content.includes('tb-rotating-track'), 'Must support rotating one-by-one mode');
    assert.ok(content.includes('tb-static-center'), 'Must support static center mode');
    assert.ok(content.includes('app.metafields.announcement_bar.settings.value'), 'Must read announcement_bar metafield');
  });

  it('assets/announcement-bar.css contains marquee keyframe animations and slide transitions', () => {
    const filePath = path.join(rootDir, 'extensions/totalbundle-theme-ext/assets/announcement-bar.css');
    assert.ok(fs.existsSync(filePath), 'announcement-bar.css must exist');

    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('tb-marquee-scroll'), 'Must define marquee keyframe animation');
    assert.ok(content.includes('tb-rotating-slide'), 'Must define rotating slide styles');
    assert.ok(content.includes('tb-announcement-bar'), 'Must define main bar container');
  });

  it('assets/announcement-bar.js contains timer rotation, dismiss persistence, and live settings', () => {
    const filePath = path.join(rootDir, 'extensions/totalbundle-theme-ext/assets/announcement-bar.js');
    assert.ok(fs.existsSync(filePath), 'announcement-bar.js must exist');

    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('TotalBundleAnnouncementBar'), 'Must define constructor');
    assert.ok(content.includes('startRotation'), 'Must support automatic slide rotation');
    assert.ok(content.includes('sessionStorage'), 'Must persist dismiss state via sessionStorage');
    assert.ok(content.includes('/api/announcement-bar-settings'), 'Must fetch live settings');
  });

  it('app/routes/api.announcement-bar-settings.ts and app.announcement-bar.tsx exist', () => {
    const apiRoute = path.join(rootDir, 'app/routes/api.announcement-bar-settings.ts');
    const appRoute = path.join(rootDir, 'app/routes/app.announcement-bar.tsx');
    assert.ok(fs.existsSync(apiRoute), 'api.announcement-bar-settings.ts must exist');
    assert.ok(fs.existsSync(appRoute), 'app.announcement-bar.tsx must exist');
  });
});

