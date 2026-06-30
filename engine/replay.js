// engine/replay.js
// 업무Portal v2 Web — Replay Engine
//
// 역할:
//   audit log → deterministic reconstruction → snapshot 반환
//   "저장 복원"이 아니라 "이벤트 재실행으로 상태 재구성"
//
// 규칙:
//   reducer는 dispatch와 동일한 함수 사용 (determinism 보장)
//   store.replaceSnapshot() 호출 금지 — 반환값만 제공
//   UI trigger 금지
//   non-deterministic 연산 금지 (Date.now(), Math.random() 등)
//   replay 자체는 새로운 audit event를 생성하지 않음

import { reduce }          from './reducer.js';
import { createSnapshot, updateSnapshot, ENGINE_VERSION } from '../core/snapshot.js';

/* --- SECTION: REPLAY --- */

/**
 * replay — audit log 전체를 순서대로 재실행 → 최종 snapshot 반환
 *
 * @param {Array} auditLog - AuditEvent[] (pushAuditEvent로 쌓인 순서)
 * @param {object|null} baseSnapshot - 재생 시작점 (null = 초기 상태)
 * @returns {object} 재구성된 Snapshot (freeze는 store에서)
 */
export function replay(auditLog = [], baseSnapshot = null) {
  if (!Array.isArray(auditLog)) {
    throw new Error('[Replay] INVALID: auditLog must be Array');
  }

  let current = baseSnapshot ?? null;

  for (let i = 0; i < auditLog.length; i++) {
    const event = auditLog[i];

    try {
      current = _applyEvent(current, event, i);
    } catch(e) {
      throw new Error(`[Replay] failed at event[${i}] (${event?.action}): ${e.message}`);
    }
  }

  return current;
}

/**
 * replayTo — audit log를 특정 index까지만 재실행 (time-travel)
 *
 * @param {Array}  auditLog
 * @param {number} targetIndex - 포함 (0-based)
 * @param {object|null} baseSnapshot
 * @returns {object} 재구성된 Snapshot
 */
export function replayTo(auditLog = [], targetIndex, baseSnapshot = null) {
  if (targetIndex < 0 || targetIndex >= auditLog.length) {
    throw new Error(`[Replay] targetIndex out of range: ${targetIndex}`);
  }
  return replay(auditLog.slice(0, targetIndex + 1), baseSnapshot);
}

/**
 * verifyReplay — audit log 재실행 후 afterHash 검증
 * audit chain integrity와 reducer determinism 동시 확인
 *
 * @param {Array}  auditLog
 * @param {Function} hashFn - snapshotHash(snapshot) → string
 * @returns {{ valid: boolean, failedAt?: number, expected?: string, got?: string }}
 */
export function verifyReplay(auditLog, hashFn) {
  let current = null;

  for (let i = 0; i < auditLog.length; i++) {
    const event = auditLog[i];
    try {
      current = _applyEvent(current, event, i);
    } catch(e) {
      return { valid: false, failedAt: i, reason: e.message };
    }

    const replayedHash = hashFn(current);
    if (replayedHash !== event.afterHash) {
      return {
        valid:    false,
        failedAt: i,
        action:   event.action,
        expected: event.afterHash,
        got:      replayedHash,
      };
    }
  }

  return { valid: true, length: auditLog.length };
}

/* --- SECTION: INTERNAL --- */

function _applyEvent(prevSnapshot, event, idx) {
  if (!event || typeof event.action !== 'string') {
    throw new Error(`event[${idx}] missing action`);
  }

  // R2: engine_version lock — 다른 버전 event는 replay 거부
  if (event.engine_version && event.engine_version !== ENGINE_VERSION) {
    throw new Error(
      `[Replay] engine_version mismatch at event[${idx}]: ` +
      `stored=${event.engine_version}, current=${ENGINE_VERSION}`
    );
  }

  const action = {
    type:    event.action,
    payload: event.payload ?? null,
  };

  const prevData = prevSnapshot?.data ?? null;
  const nextData = reduce(action, prevData);

  return prevSnapshot
    ? updateSnapshot(prevSnapshot, { data: nextData, settings: prevSnapshot.settings })
    : createSnapshot({ data: nextData });
}
