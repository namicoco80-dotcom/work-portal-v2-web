// core/ui-store.js
// 업무Portal v2 Web — UI_STATE Ephemeral Store
//
// 규칙:
//   Snapshot과 완전 분리 — persist/audit 대상 아님
//   허용 key 외 injection 즉시 throw
//   render trigger 역할만 — domain data 절대 포함 금지

/* --- SECTION: SCHEMA --- */
const UI_SCHEMA = Object.freeze({
  selectedDate: 'string',
  activeTab:    'string',   // 'calendar' | 'todo' | 'memo' | 'snapshot'
  modalOpen:    'nullable', // null | string
  searchQuery:  'string',
});

/* --- SECTION: STATE --- */
const UI_STATE = {
  selectedDate: new Date().toISOString().slice(0, 10),
  activeTab:    'calendar',
  modalOpen:    null,
  searchQuery:  '',
};

/* --- SECTION: REGISTRY --- */
const _listeners = new Set();

/* --- SECTION: INTERNAL --- */
function _assertValidPatch(patch) {
  for (const key of Object.keys(patch)) {
    if (!(key in UI_SCHEMA)) {
      throw new Error(`[UI_STATE] INVALID KEY: "${key}" — 허용 key: ${Object.keys(UI_SCHEMA).join(', ')}`);
    }
  }
}

function _snapshot() {
  return Object.freeze({ ...UI_STATE });
}

/* --- SECTION: API --- */
export const uiStore = {
  /** 현재 UI_STATE shallow-frozen copy 반환 */
  get() {
    return _snapshot();
  },

  /** patch 적용 후 subscribers 알림
   *  schema 위반 key → 즉시 throw (침투 차단)
   */
  set(patch) {
    _assertValidPatch(patch);
    Object.assign(UI_STATE, patch);
    const snap = _snapshot();
    _listeners.forEach(fn => fn(snap));
  },

  /** subscriber 등록 + 즉시 현재 상태 동기화 (deterministic bootstrap)
   *  반환값: unsubscribe 함수
   */
  subscribe(fn) {
    _listeners.add(fn);
    fn(_snapshot()); // initial sync
    return () => _listeners.delete(fn);
  },
};
