import { describe, expect, it } from 'vitest';
import {
  decodeSharePayload,
  encodeSharePayload,
  getShareHash,
} from '../../src/lib/shareLink.ts';

describe('share links', () => {
  it('round-trips a snippet and token JSON through compression', async () => {
    const payload = {
      html: '<main><h1>Hello</h1><p class="text-slate-600">World</p></main>',
      tokenJson: '{"color":{"ink":"#111827"}}',
    };

    const encoded = await encodeSharePayload(payload);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);

    const decoded = await decodeSharePayload(encoded);
    expect(decoded).toEqual(payload);
  });

  it('rejects malformed or non-snippet payloads', async () => {
    await expect(decodeSharePayload('not-valid-base64!!!')).resolves.toBeNull();
    await expect(decodeSharePayload('')).resolves.toBeNull();
  });

  it('reads a share hash from the location', () => {
    window.location.hash = '#share=abc123';
    expect(getShareHash()).toBe('abc123');

    window.location.hash = '#other=value';
    expect(getShareHash()).toBeNull();

    window.location.hash = '';
  });
});
