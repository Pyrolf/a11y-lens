export interface AuditHistoryEntry {
  id: string;
  ranAt: string;
  issueCount: number;
  errors: number;
  warnings: number;
  infos: number;
  totalRules: number;
  snippetPreview: string;
}

const DB_NAME = 'a11y-lens-history';
const STORE_NAME = 'audits';
const MAX_ENTRIES = 25;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('ranAt', 'ranAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function saveAuditHistory(entry: AuditHistoryEntry): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(entry);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });

  // Prune older entries so local storage stays bounded.
  const entries = await listAuditHistory();
  if (entries.length <= MAX_ENTRIES) {
    db.close();
    return;
  }
  const stale = entries.slice(MAX_ENTRIES);
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const item of stale) store.delete(item.id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
  db.close();
}

export async function listAuditHistory(): Promise<AuditHistoryEntry[]> {
  const db = await openDatabase();
  if (!db) return [];
  const entries = await new Promise<AuditHistoryEntry[]>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as AuditHistoryEntry[]) ?? []);
    request.onerror = () => resolve([]);
  });
  db.close();
  return entries.sort((a, b) => (a.ranAt < b.ranAt ? 1 : -1));
}

export async function clearAuditHistory(): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
  db.close();
}