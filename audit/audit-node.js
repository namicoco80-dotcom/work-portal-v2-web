// audit/audit-node.js
// 업무Portal v2 Web — Audit Event Schema
//
// 규칙:
//   AuditEvent는 append-only (생성 후 수정 금지)
//   beforeHash / afterHash로 snapshot chain integrity 보장
//   Engine / Store / Snapshot 구조 변경 금지

import { ENGINE_VERSION } from '../core/snapshot.js';

/* --- SECTION: VERSION --- */
export const AUDIT_VERSION = '1.0';

/* --- SECTION: HASH --- */

/**
 * snapshotHash — 경량 무결성 힌트 (암호학적 보장 아님)
 * 동일 snapshot.data → 동일 hash (deterministic)
 */
export function snapshotHash(snapshot) {
  if (!snapshot) return 'null';
  const str = JSON.stringify(snapshot.data ?? {});
  // djb2 변형: 빠르고 충분히 고유
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // uint32
  }
  return h.toString(16).padStart(8, '0');
}

/* --- SECTION: FACTORY --- */

/**
 * createAuditEvent — 불변 AuditEvent 생성
 * @param {object} action        - { type, payload }
 * @param {object|null} prev     - 이전 Snapshot
 * @param {object} next          - 다음 Snapshot
 * @returns {object} frozen AuditEvent
 */
export function createAuditEvent(action, prev, next) {
  const id = `ae-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return Object.freeze({
    audit_version:  AUDIT_VERSION,
    engine_version: ENGINE_VERSION,       // R2: version lock — replay 시 검증 기준
    id,
    timestamp:    Date.now(),
    action:       action?.type    ?? 'UNKNOWN',
    payload:      Object.freeze(action?.payload ?? null),
    beforeHash:   snapshotHash(prev),
    afterHash:    snapshotHash(next),
    prevSnapshot: prev?.metadata?.updatedAt ?? prev?.updatedAt ?? null,
    nextSnapshot: next?.updatedAt ?? null,
  });
}
