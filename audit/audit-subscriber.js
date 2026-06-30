// audit/audit-subscriber.js
// 업무Portal v2 Web — Audit Subscriber
//
// 역할:
//   store.subscribe() 기반 audit chain 자동 생성
//   dispatch._getLastAction() → action 맥락 캡처
//   Engine / Store / Snapshot 계약 변경 없음
//
// 연결 방식:
//   store.subscribe(next) 호출 시 prev를 자체 보관하고
//   _getLastAction()으로 action 맥락 가져와 AuditEvent 생성

import { subscribe, getSnapshot } from '../core/store.js';
import { _getLastAction }         from '../engine/dispatch.js';
import { createAuditEvent }       from './audit-node.js';
import { pushAuditEvent }         from './audit-store.js';

/* --- SECTION: WIRING --- */
let _wired   = false;
let _prevSnap = null;

/**
 * initAudit — 앱 부팅 시 1회 호출
 * store.subscribe에 audit 관측자 등록
 */
export function initAudit() {
  if (_wired) {
    console.warn('[Audit] already wired — skipping');
    return;
  }
  _wired = true;

  // 초기 snapshot 보관 (첫 번째 subscribe 콜백은 건너뜀)
  _prevSnap = getSnapshot();
  let _booting = true;

  subscribe((nextSnap) => {
    // 초기 동기화 콜백 제외 — audit 대상 아님
    if (_booting) {
      _booting = false;
      _prevSnap = nextSnap;
      return;
    }

    const action = _getLastAction() ?? { type: 'INTERNAL', payload: null };

    try {
      const event = createAuditEvent(action, _prevSnap, nextSnap);
      pushAuditEvent(event);
    } catch(e) {
      console.error('[Audit] event creation failed:', e.message);
    } finally {
      _prevSnap = nextSnap;
    }
  });

  console.info('[Audit] wired');
}
