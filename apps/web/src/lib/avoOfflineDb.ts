import type { QueueCustomer } from '../api/verifications.api.ts';

export interface PendingSubmission {
  id: string;
  customerId: string;
  customerName: string;
  photoBlob: Blob | null;
  gps: { lat: number; lng: number; accuracy: number };
  checks: {
    addressVerified: boolean;
    employerVerified: boolean;
    guarantor1Reachable: boolean;
    guarantor2Reachable: boolean;
  };
  notes: string;
  decision: 'APPROVED' | 'REJECTED';
  createdAt: string;
}

const DB_NAME = 'assaan_avo_v1';
const DB_VER  = 1;

let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('queue'))   db.createObjectStore('queue',   { keyPath: 'id' });
      if (!db.objectStoreNames.contains('pending')) db.createObjectStore('pending', { keyPath: 'id' });
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror   = () => reject(req.error);
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

export const avoDb = {
  async saveQueue(items: QueueCustomer[]) {
    const db = await openDb();
    const t  = db.transaction('queue', 'readwrite');
    const s  = t.objectStore('queue');
    s.clear();
    for (const item of items) s.put(item);
    return new Promise<void>((res, rej) => {
      t.oncomplete = () => res();
      t.onerror    = () => rej(t.error);
    });
  },

  async getQueue(): Promise<QueueCustomer[]> {
    const db = await openDb();
    return idbReq(db.transaction('queue', 'readonly').objectStore('queue').getAll());
  },

  async addPending(sub: PendingSubmission): Promise<void> {
    const db = await openDb();
    await idbReq(db.transaction('pending', 'readwrite').objectStore('pending').put(sub));
  },

  async getAllPending(): Promise<PendingSubmission[]> {
    const db = await openDb();
    return idbReq(db.transaction('pending', 'readonly').objectStore('pending').getAll());
  },

  async removePending(id: string): Promise<void> {
    const db = await openDb();
    await idbReq(db.transaction('pending', 'readwrite').objectStore('pending').delete(id));
  },

  async countPending(): Promise<number> {
    const db = await openDb();
    return idbReq(db.transaction('pending', 'readonly').objectStore('pending').count());
  },
};
