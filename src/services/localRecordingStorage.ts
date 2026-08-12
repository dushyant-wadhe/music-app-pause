const DB_NAME = "riyaaz-local-recordings";
const DB_VERSION = 1;
const STORE_NAME = "recording-audio";
const LOCAL_PREFIX = "local:";

function canUseIndexedDb() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

function storageKey(recordingId: string) {
  return `${LOCAL_PREFIX}${recordingId}`;
}

function parseStorageId(storageUrl: string) {
  return storageUrl.startsWith(LOCAL_PREFIX) ? storageUrl.slice(LOCAL_PREFIX.length) : storageUrl;
}

export async function saveRecordingBlob(recordingId: string, blob: Blob): Promise<string | null> {
  if (!canUseIndexedDb()) return null;
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to save recording blob."));
    tx.objectStore(STORE_NAME).put(blob, recordingId);
  });

  return storageKey(recordingId);
}

export async function saveBlobUrlAsRecording(recordingId: string, blobUrl: string): Promise<string | null> {
  if (!blobUrl) return null;
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return saveRecordingBlob(recordingId, blob);
}

export async function loadRecordingBlob(storageUrl: string): Promise<Blob | null> {
  if (!canUseIndexedDb() || !storageUrl) return null;
  const recordingId = parseStorageId(storageUrl);
  const db = await openDb();

  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    tx.onerror = () => reject(tx.error ?? new Error("Failed to load recording blob."));
    const request = tx.objectStore(STORE_NAME).get(recordingId);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Failed to read recording blob."));
  });
}

export async function deleteRecordingBlob(storageUrl: string | null | undefined): Promise<void> {
  if (!canUseIndexedDb() || !storageUrl) return;
  const recordingId = parseStorageId(storageUrl);
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to delete recording blob."));
    tx.objectStore(STORE_NAME).delete(recordingId);
  });
}
