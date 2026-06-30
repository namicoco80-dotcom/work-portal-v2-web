// core/bootstrap.js
// 업무Portal v2 Web — Bootstrap (App Entry Recovery Flow)
//
// 역할:
//   앱 시작 시 단일 진입점
//   load → version check → replay verify → hydrate → render
//
// 규칙:
//   bootstrap 완료 전 render 호출 금지
//   실패 시 clean initial state로 안전 복구
//   store/persistence/replay/audit의 유일한 조율자

import { createBootSnapshot, ENGINE_VERSION } from './snapshot.js';
import { store, initStore }                   from './store.js';
import { load, health }                       from './persistence.js';
import { verifyReplay }                       from '../engine/replay.js';
import { snapshotHash }                       from '../audit/audit-node.js';
import { initAudit }                          from '../audit/audit-subscriber.js';
import { pushAuditEvent, _resetAuditStore }   from '../audit/audit-store.js';

/* --- SECTION: BOOTSTRAP --- */

/**
 * bootstrap — 앱 진입점 단일 함수
 *
 * @param {object} opts
 * @param {Function} opts.initSchedulerFn  - initRenderScheduler(store, uiStore, renderFn)
 * @param {object}   opts.uiStore          - core/ui-store.js uiStore
 * @param {Function} opts.renderFn         - render(snapshot, ui)
 * @param {Function} opts.forceRenderFn    - forceRender()
 * @returns {{ status: string, reason?: string, auditCount?: number }}
 */
export async function bootstrap({ initSchedulerFn, uiStore, renderFn, forceRenderFn }) {
  console.info('[Bootstrap] starting...');

  /* 1. localStorage health */
  const h = health();
  if (!h.ok) {
    console.warn('[Bootstrap] storage unavailable:', h.reason);
    return _bootFresh({ initSchedulerFn, uiStore, renderFn, forceRenderFn,
                        reason: 'storage_unavailable' });
  }

  /* 2. load */
  const { snapshot: saved, auditLog: savedLog } = load();

  if (!saved) {
    console.info('[Bootstrap] no saved state');
    return _bootFresh({ initSchedulerFn, uiStore, renderFn, forceRenderFn,
                        reason: 'no_saved_state' });
  }

  /* 3. engine_version check */
  if (saved.engine_version !== ENGINE_VERSION) {
    console.warn(`[Bootstrap] version mismatch (${saved.engine_version} ≠ ${ENGINE_VERSION})`);
    return _bootFresh({ initSchedulerFn, uiStore, renderFn, forceRenderFn,
                        reason: 'version_mismatch' });
  }

  /* 4. audit chain verify (log가 있을 때만) */
  if (savedLog.length > 0) {
    const vr = verifyReplay(savedLog, snapshotHash);
    if (!vr.valid) {
      console.warn('[Bootstrap] audit chain broken — dropping audit, keeping snapshot:', vr);
      return _hydrate(saved, [], { initSchedulerFn, uiStore, renderFn, forceRenderFn,
                                   reason: 'audit_dropped' });
    }
  }

  /* 5. 정상 복원 */
  return _hydrate(saved, savedLog, { initSchedulerFn, uiStore, renderFn, forceRenderFn,
                                     reason: 'restored' });
}

/* --- SECTION: INTERNAL --- */

function _bootFresh({ initSchedulerFn, uiStore, renderFn, forceRenderFn, reason }) {
  const snap = createBootSnapshot();
  initStore(snap);
  initAudit();
  initSchedulerFn(store, uiStore, renderFn);
  forceRenderFn();
  console.info(`[Bootstrap] fresh (${reason})`);
  return { status: 'fresh', reason };
}

function _hydrate(snapshot, auditLog, { initSchedulerFn, uiStore, renderFn, forceRenderFn, reason }) {
  // store 초기화
  initStore(snapshot);

  // audit log 복원 (append-only)
  _resetAuditStore();
  auditLog.forEach(e => pushAuditEvent(e));

  // audit subscriber 연결
  initAudit();

  // render scheduler 연결
  initSchedulerFn(store, uiStore, renderFn);
  forceRenderFn();

  console.info(`[Bootstrap] hydrated (${reason}) — audit: ${auditLog.length}`);
  return { status: reason, auditCount: auditLog.length };
}
