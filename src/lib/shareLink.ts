export interface SharePayload {
  html: string;
  tokenJson?: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Compresses a snippet (and optional token JSON) into a URL-safe string. */
export async function encodeSharePayload(payload: SharePayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const stream = readable.pipeThrough(new CompressionStream('gzip') as any);
  const compressed = await new Response(stream).arrayBuffer();
  return bytesToBase64Url(new Uint8Array(compressed));
}

/** Returns the decoded payload, or null when the hash is missing or invalid. */
export async function decodeSharePayload(value: string): Promise<SharePayload | null> {
  try {
    const bytes = base64UrlToBytes(value);
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const stream = readable.pipeThrough(new DecompressionStream('gzip') as any);
    const decompressed = await new Response(stream).arrayBuffer();
    const parsed = JSON.parse(new TextDecoder().decode(decompressed)) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const html = (parsed as { html?: unknown }).html;
    if (typeof html !== 'string') return null;
    const tokenJson = (parsed as { tokenJson?: unknown }).tokenJson;
    return {
      html,
      tokenJson: typeof tokenJson === 'string' ? tokenJson : undefined,
    };
  } catch {
    return null;
  }
}

export function getShareHash(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash.startsWith('share=')) return null;
  return hash.slice('share='.length);
}