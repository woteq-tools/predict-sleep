import test from 'node:test';
import assert from 'node:assert/strict';

import {
  KEYS,
  DEFAULTS,
  getItem,
  setItem,
  removeItem,
  resetStorageCache,
  isPersistentStorage,
  clampAwakeMinutes,
  roundToStep,
  getAwakeMinutes,
  setAwakeMinutes,
  getLastWakeMs,
  setLastWakeMs,
  clearLastWakeMs,
  getSavedZone,
  setSavedZone,
  getHistory,
  addHistoryEntry,
  clearHistory,
  getNotifyEnabled,
  setNotifyEnabled,
  getNotifyLeadMinutes,
  setNotifyLeadMinutes,
} from '../storage.js';

/** A minimal in-memory stand-in for the browser localStorage. */
class FakeStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(String(key), String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

/** A localStorage that refuses to work, like private mode with storage disabled. */
const hostileStorage = {
  getItem() {
    throw new Error('storage denied');
  },
  setItem() {
    throw new Error('storage denied');
  },
  removeItem() {
    throw new Error('storage denied');
  },
};

/** Run a test body with a given storage implementation installed. */
function withStorage(storage, body) {
  const had = 'localStorage' in globalThis;
  const original = globalThis.localStorage;
  globalThis.localStorage = storage;
  resetStorageCache();
  try {
    body();
  } finally {
    if (had) globalThis.localStorage = original;
    else delete globalThis.localStorage;
    resetStorageCache();
  }
}

test('getItem and setItem round trip JSON values', () => {
  withStorage(new FakeStorage(), () => {
    assert.equal(getItem('missing', 'fallback'), 'fallback');
    assert.equal(setItem('key', { a: 1 }), true);
    assert.deepEqual(getItem('key'), { a: 1 });
    removeItem('key');
    assert.equal(getItem('key', null), null);
  });
});

test('getItem survives corrupted values', () => {
  withStorage(new FakeStorage(), () => {
    globalThis.localStorage.setItem('broken', '{not json');

    assert.equal(getItem('broken', 'fallback'), 'fallback');
  });
});

test('setItem reports failure for values that cannot be encoded', () => {
  withStorage(new FakeStorage(), () => {
    const circular = {};
    circular.self = circular;

    assert.equal(setItem('circular', circular), false);
  });
});

test('the awake duration defaults to 16 hours', () => {
  withStorage(new FakeStorage(), () => {
    assert.equal(getAwakeMinutes(), DEFAULTS.awakeMinutes);
    assert.equal(getAwakeMinutes(), 960);
  });
});

test('the awake duration is clamped and snapped to 15 minute steps', () => {
  withStorage(new FakeStorage(), () => {
    assert.equal(clampAwakeMinutes(10), DEFAULTS.minAwakeMinutes);
    assert.equal(clampAwakeMinutes(99999), DEFAULTS.maxAwakeMinutes);
    assert.equal(clampAwakeMinutes('nonsense'), DEFAULTS.awakeMinutes);
    assert.equal(roundToStep(970), 975, 'snaps to the nearest quarter hour');
    assert.equal(roundToStep(960), 960);
    assert.equal(roundToStep(1000), 1005);
  });
});

test('the awake duration persists', () => {
  withStorage(new FakeStorage(), () => {
    setAwakeMinutes(945);

    assert.equal(getAwakeMinutes(), 945);
    assert.equal(globalThis.localStorage.getItem(KEYS.awakeMinutes), '945');
  });
});

test('the last wake-up time is stored as epoch milliseconds', () => {
  withStorage(new FakeStorage(), () => {
    assert.equal(getLastWakeMs(), null);

    const now = Date.now();
    setLastWakeMs(now);

    assert.equal(getLastWakeMs(), now);
    assert.equal(typeof globalThis.localStorage.getItem(KEYS.lastWakeMs), 'string');

    clearLastWakeMs();
    assert.equal(getLastWakeMs(), null);
  });
});

test('the saved time zone is stored', () => {
  withStorage(new FakeStorage(), () => {
    assert.equal(getSavedZone(), null);

    setSavedZone('Europe/Berlin');

    assert.equal(getSavedZone(), 'Europe/Berlin');
  });
});

test('history keeps the newest entry first', () => {
  withStorage(new FakeStorage(), () => {
    assert.deepEqual(getHistory(), []);

    addHistoryEntry({ wakeMs: 1, bedtimeMs: 2, awakeMinutes: 960 });
    addHistoryEntry({ wakeMs: 3, bedtimeMs: 4, awakeMinutes: 960 });

    const history = getHistory();
    assert.equal(history.length, 2);
    assert.equal(history[0].wakeMs, 3);
    assert.equal(history[1].wakeMs, 1);
  });
});

test('history is capped', () => {
  withStorage(new FakeStorage(), () => {
    for (let i = 0; i < DEFAULTS.historyLimit + 25; i += 1) {
      addHistoryEntry({ wakeMs: i, bedtimeMs: i + 1, awakeMinutes: 960 });
    }

    const history = getHistory();
    assert.equal(history.length, DEFAULTS.historyLimit);
    assert.equal(history[0].wakeMs, DEFAULTS.historyLimit + 24, 'the newest entry stays on top');
  });
});

test('history ignores malformed entries', () => {
  withStorage(new FakeStorage(), () => {
    globalThis.localStorage.setItem(KEYS.history, JSON.stringify([{ nope: true }, 'string', null]));

    assert.deepEqual(getHistory(), []);
  });
});

test('history can be cleared', () => {
  withStorage(new FakeStorage(), () => {
    addHistoryEntry({ wakeMs: 1, bedtimeMs: 2, awakeMinutes: 960 });
    clearHistory();

    assert.deepEqual(getHistory(), []);
  });
});

test('notification preferences persist', () => {
  withStorage(new FakeStorage(), () => {
    assert.equal(getNotifyEnabled(), false);
    assert.equal(getNotifyLeadMinutes(), 30);

    setNotifyEnabled(true);
    setNotifyLeadMinutes(45);

    assert.equal(getNotifyEnabled(), true);
    assert.equal(getNotifyLeadMinutes(), 45);
  });
});

test('the app keeps working when storage is blocked', () => {
  withStorage(hostileStorage, () => {
    assert.equal(isPersistentStorage(), false);

    setAwakeMinutes(840);
    setLastWakeMs(1234);

    assert.equal(getAwakeMinutes(), 840, 'values are kept in memory');
    assert.equal(getLastWakeMs(), 1234);
    assert.equal(setItem('anything', 1), false, 'the caller can tell it was not persisted');
  });
});
