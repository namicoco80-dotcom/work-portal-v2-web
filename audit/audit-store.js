// audit/audit-store.js
// 업무Portal v2 Web — Audit Store (Append-Only Log)
//
// 규칙:
//   append-only — 기존 event 수정/삭제 금지
//   AuditEvent만 보관 — Snapshot 원본 보관 금지
//   push는 audit-subscriber 전용
//   read API만 외부 공개

/* --- SECTION: STATE --- */
let _log = [];                  // AuditEvent[] — append-only
const MAX_EVENTS = 1000;        // 메모리 상한

/* --- SECTION: WRITE (audit-subscriber 전용) --- */

/**
 * pushAuditEvent — AuditEvent 추가 (append-only)
 * 외부에서 직접 호출 금지 — audit-subscriber를 통해서만
 */
export function pushAuditEvent(event) {
  if (!event || !event.id) {
    console.warn('[AuditStore] invalid event — skipped');
    return;
  }
  _log = [..._log, Object.freeze(event)];

  // 상한 초과 시 오래된 것부터 제거 (FIFO)
  if (_log.length > MAX_EVENTS) {
    _log = _log.slice(_log.length - MAX_EVENTS);
  }
}

/* --- SECTION: READ --- */

/** 전체 audit log (시간 순, 불변 배열) */
export function getAuditLog() {
  return Object.freeze([..._log]);
}

/** 최근 N개 */
export function getRecentEvents(n = 20) {
  return Object.freeze(_log.slice(-n));
}

/** action type으로 필터 */
export function getEventsByAction(type) {
  return Object.freeze(_log.filter(e => e.action === type));
}

/** snapshot hash로 chain 검증
 *  연속된 event에서 afterHash === next.beforeHash 여야 함
 */
export function verifyChain() {
  for (let i = 1; i < _log.length; i++) {
    if (_log[i].beforeHash !== _log[i - 1].afterHash) {
      return {
        valid: false,
        broken_at: i,
        expected: _log[i - 1].afterHash,
        got: _log[i].beforeHash,
      };
    }
  }
  return { valid: true, length: _log.length };
}

/** audit log 크기 */
export function getAuditCount() {
  return _log.length;
}

/* --- SECTION: RESET (테스트 전용) --- */
export function _resetAuditStore() {
  _log = [];
}
