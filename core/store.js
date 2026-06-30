// core/store.js
// 업무Portal v2 Web — Snapshot Store
//
// 역할:
//   Engine output 보관 (NOT state manager)
//   replace-only — merge/patch 금지
//   version lock enforcement
//   subscribe → render-scheduler 전용
//
// 규칙:
//   UI → store 직접 접근 금지
//   store → UI_STATE 접근 금지
//   replaceSnapshot은 Engine(dispatch) 만 호출

/* --- SECTION: STATE --- */
let _snapshot = null;
const _listeners = new Set();

/* --- SECTION: IMMUTABILITY --- */
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  if (Array.isArray(obj)) {
    obj.forEach(deepFreeze);           // 배열 요소 순회
  } else {
    Object.values(obj).forEach(deepFreeze); // 객체 값 순회
  }
  return obj;
}

/* --- SECTION: READ --- */

/** 현재 Snapshot deep-frozen copy 반환 */
export function getSnapshot() {
  return _snapshot ? deepFreeze(_snapshot) : null;
}

/* --- SECTION: WRITE (Engine 전용) --- */

/**
 * replaceSnapshot — Snapshot 완전 교체 (merge 금지)
 * Engine dispatch 레이어만 호출 허용
 */
export function replaceSnapshot(nextSnapshot) {
  if (!nextSnapshot || typeof nextSnapshot !== 'object') {
    throw new Error('[Store] INVALID SNAPSHOT: null or non-object');
  }
  if (!nextSnapshot.engine_version) {
    throw new Error('[Store] INVALID SNAPSHOT: missing engine_version');
  }

  _snapshot = nextSnapshot;
  const frozen = deepFreeze(_snapshot);
  _listeners.forEach(fn => {
    try { fn(frozen); }
    catch(e) { console.error('[Store] subscriber error:', e); }
  });
}

/* --- SECTION: SUBSCRIBE --- */

/**
 * subscribe — Snapshot 변경 시 fn 호출
 * 등록 즉시 현재 Snapshot으로 초기 동기화
 * @returns unsubscribe 함수
 */
export function subscribe(fn) {
  _listeners.add(fn);
  if (_snapshot) fn(deepFreeze(_snapshot));
  return () => _listeners.delete(fn);
}

/* --- SECTION: BOOTSTRAP --- */

/**
 * initStore — 앱 시작 시 초기 Snapshot 주입
 * Repository.load() 결과 또는 createBootSnapshot() 전달
 */
export function initStore(initialSnapshot) {
  if (_snapshot) {
    console.warn('[Store] already initialized — skipping');
    return;
  }
  replaceSnapshot(initialSnapshot);
}

/* --- SECTION: STORE OBJECT (render-scheduler 주입용) --- */
export const store = {
  getSnapshot,
  replaceSnapshot,
  subscribe,
  initStore,
};
