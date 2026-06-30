// core/snapshot.js
// 업무Portal v2 Web — Snapshot Schema & Factory
//
// 규칙:
//   Snapshot = Engine output container (NOT state manager)
//   UI_STATE 포함 금지 (selectedDate, activeTab 등)
//   createSnapshot() 외부에서 Snapshot 직접 생성 금지
//   version lock — ENGINE_VERSION 불일치 시 fail-fast

/* --- SECTION: VERSION LOCK --- */
export const ENGINE_VERSION = '1.0';

/* --- SECTION: INITIAL DATA --- */
export function createInitialData() {
  return {
    calendar: { events: [] },
    todos:    { items:  [] },
    memo:     { byDate: {} },
    settings: {},
  };
}

/* --- SECTION: FACTORY --- */

/**
 * createSnapshot — Engine output → 불변 Snapshot 생성
 * @param {object} engineOutput - Engine이 생성한 data payload
 * @returns {object} frozen Snapshot
 */
export function createSnapshot(engineOutput) {
  _validate(engineOutput);

  // freeze는 store.js의 deepFreeze에 위임 — 여기서 shallow freeze 금지
  return {
    engine_version: ENGINE_VERSION,
    createdAt:      new Date().toISOString(),
    updatedAt:      new Date().toISOString(),
    data:           engineOutput.data,
    settings:       engineOutput.settings ?? {},
  };
}

/**
 * updateSnapshot — 기존 Snapshot + Engine delta → 새 Snapshot
 * merge 금지 — 완전 교체
 */
export function updateSnapshot(prev, engineOutput) {
  _validate(engineOutput);
  _assertVersionMatch(prev);

  return {
    engine_version: ENGINE_VERSION,
    createdAt:      prev.createdAt,
    updatedAt:      new Date().toISOString(),
    data:           engineOutput.data,
    settings:       engineOutput.settings ?? prev.settings ?? {},
  };
}

/* --- SECTION: VALIDATION (FAIL FAST) --- */

function _validate(engineOutput) {
  if (!engineOutput || typeof engineOutput !== 'object') {
    throw new Error('[Snapshot] INVALID: engineOutput must be object');
  }
  if (!engineOutput.data) {
    throw new Error('[Snapshot] INVALID: missing data field');
  }
  if (!engineOutput.data.calendar || !engineOutput.data.todos || !engineOutput.data.memo) {
    throw new Error('[Snapshot] INVALID: data must include calendar, todos, memo');
  }
}

function _assertVersionMatch(snapshot) {
  if (snapshot?.engine_version !== ENGINE_VERSION) {
    throw new Error(
      `[Snapshot] VERSION MISMATCH: stored=${snapshot?.engine_version}, current=${ENGINE_VERSION}`
    );
  }
}

/* --- SECTION: BOOTSTRAP --- */

/** 앱 최초 실행 시 초기 Snapshot 생성 */
export function createBootSnapshot() {
  return createSnapshot({ data: createInitialData() });
}
