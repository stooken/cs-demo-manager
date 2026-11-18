import { useEffect, useSyncExternalStore } from 'react';
import type { Strategy } from './strategy';

type Library = {
  strategies: Strategy[];
  ready: boolean;
  status: 'saved' | 'saving' | 'error';
};
let state: Library = { strategies: [], ready: false, status: 'saved' };
const listeners = new Set<() => void>();
let db: IDBDatabase | undefined;
let opening = false;
const dirty = new Map<string, Strategy | null>();
let writing = false;

function publish(updates: Partial<Library>) {
  state = { ...state, ...updates };
  for (const listener of listeners) listener();
}

export function loadLibrary() {
  if (opening || db) return;
  opening = true;
  const request = indexedDB.open('csdm-playbook', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('strategies', { keyPath: 'id' });
  function failed() {
    opening = false;
    publish({ status: 'error' });
  }
  request.onerror = failed;
  request.onsuccess = () => {
    const connection = request.result;
    const read = connection.transaction('strategies').objectStore('strategies').getAll();
    read.onerror = () => {
      connection.close();
      failed();
    };
    read.onsuccess = () => {
      opening = false;
      db = connection;
      publish({ strategies: read.result, ready: true, status: 'saved' });
    };
  };
}

export function flushLibrary() {
  if (!db || writing || dirty.size === 0) return;
  writing = true;
  const batch = new Map(dirty);
  function failed() {
    writing = false;
    publish({ status: 'error' });
  }
  try {
    const transaction = db.transaction('strategies', 'readwrite');
    transaction.onabort = failed;
    transaction.oncomplete = () => {
      for (const [id, item] of batch) {
        if (dirty.get(id) === item) dirty.delete(id);
      }
      writing = false;
      if (dirty.size === 0) publish({ status: 'saved' });
      else flushLibrary();
    };
    const store = transaction.objectStore('strategies');
    for (const [id, item] of batch) {
      if (item) store.put(item);
      else store.delete(id);
    }
  } catch {
    failed();
  }
}

export function saveStrategy(strategy: Strategy) {
  const others = state.strategies.filter((item) => item.id !== strategy.id);
  dirty.set(strategy.id, strategy);
  publish({ strategies: [strategy, ...others], status: 'saving' });
  flushLibrary();
}

export function deleteStrategy(id: string) {
  dirty.set(id, null);
  publish({ strategies: state.strategies.filter((item) => item.id !== id), status: 'saving' });
  flushLibrary();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLibrary() {
  useEffect(loadLibrary, []);
  return useSyncExternalStore(subscribe, () => state);
}
