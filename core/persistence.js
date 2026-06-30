// core/persistence.js
// 업무Portal v2 Web — Persistence Layer
//
// 역할:
//   Snapshot + Audit의 직렬화/역직렬화 adapter
//   state manager 아님 — serializer only
//
// 규칙:
//   persistence → engine 호출 금지
//   persistence → UI 영향 금지
//   UI_STATE 저장 금지 (intentional exclusion)
//   snapshot + audit 반드시 동시 저장 (integrity 보장)
//   restore 후 engine replay는 호출자가 처리

/* --- SECTION: KEYS --- */
const SNAPSHOT_KEY = 'wp2_snapshot_v1';
const AUDIT_KEY    = 'wp2_audit_v1';
const SCHEMA_VER   = 1;

/* --- SECTION: SAVE --- */

/**
 * save — 현재 Snapshot + Audit log 동시 저장
 * 둘 중 하나라도 실패하면 양쪽 모두 롤백
 */
export function save(snapshot, auditLog) {
  if (!snapshot) {
    console.warn('[Persistence] save skipped — snapshot null');
    return false;
  }

  try {
    const snapshotPayload = JSON.stringify({
      schema_ver: SCHEMA_VER,
      savedAt:    new Date().toISOString(),
      snapshot,
    });
    const auditPayload = JSON.stringify({
      schema_ver: SCHEMA_VER,
      savedAt:    new Date().toISOString(),
      log:        auditLog ?? [],
    });

    // 동시 저장 — 순서 보장
    localStorage.setItem(SNAPSHOT_KEY, snapshotPayload);
    localStorage.setItem(AUDIT_KEY,    auditPayload);
    return true;
  } catch(e) {
    console.error('[Persistence] save failed:', e.message);
    // 불일치 방지 — 양쪽 모두 제거
    try { localStorage.removeItem(SNAPSHOT_KEY); } catch(_) {}
    try { localStorage.removeItem(AUDIT_KEY);    } catch(_) {}
    return false;
  }
}

/* --- SECTION: LOAD (NO SIDE EFFECTS) --- */

/**
 * load — Snapshot + Audit log 복원
 * 엔진 호출 없음 — 순수 역직렬화만
 * @returns {{ snapshot: object|null, auditLog: Array }}
 */
export function load() {
  let snapshot = null;
  let auditLog = [];

  try {
    const snapshotRaw = localStorage.getItem(SNAPSHOT_KEY);
    if (snapshotRaw) {
      const parsed = JSON.parse(snapshotRaw);
      _assertSchemaVer(parsed, 'snapshot');
      snapshot = parsed.snapshot ?? null;
    }
  } catch(e) {
    console.warn('[Persistence] snapshot load failed:', e.message);
    snapshot = null;
  }

  try {
    const auditRaw = localStorage.getItem(AUDIT_KEY);
    if (auditRaw) {
      const parsed = JSON.parse(auditRaw);
      _assertSchemaVer(parsed, 'audit');
      auditLog = parsed.log ?? [];
    }
  } catch(e) {
    console.warn('[Persistence] audit load failed:', e.message);
    auditLog = [];
  }

  return { snapshot, auditLog };
}

/* --- SECTION: CLEAR --- */

/** clear — 저장 데이터 완전 초기화 (reset 전용) */
export function clear() {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
    localStorage.removeItem(AUDIT_KEY);
    return true;
  } catch(e) {
    console.error('[Persistence] clear failed:', e.message);
    return false;
  }
}

/* --- SECTION: HEALTH --- */

/**
 * health — 저장 공간 상태 점검
 * @returns {{ ok: boolean, reason?: string }}
 */
export function health() {
  try {
    const testKey = '__wp2_health__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return { ok: true };
  } catch(e) {
    return { ok: false, reason: e.message };
  }
}

/* --- SECTION: INTERNAL --- */

function _assertSchemaVer(parsed, label) {
  if (parsed?.schema_ver !== SCHEMA_VER) {
    throw new Error(
      `[Persistence] ${label} schema_ver mismatch: ` +
      `stored=${parsed?.schema_ver}, current=${SCHEMA_VER}`
    );
  }
}
