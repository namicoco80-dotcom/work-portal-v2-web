// engine/dispatch.js
// 업무Portal v2 Web — Engine Dispatch
//
// 역할:
//   Action → Engine → createSnapshot → replaceSnapshot 단일 경로
//   id/timestamp를 dispatch 시점에 주입 → replay determinism 보장
//   invalid state gate (FAIL FAST)
//   audit 연결점 (_lastAction capture)
//
// 규칙:
//   UI → dispatch() 만 호출 (replaceSnapshot 직접 호출 금지)
//   dispatch 내부에서 UI_STATE 접근 금지
//   reducer는 payload.id/createdAt을 그대로 사용 (newId 재생성 금지)

import { getSnapshot, replaceSnapshot } from '../core/store.js';
import { createSnapshot, updateSnapshot } from '../core/snapshot.js';
import { reduce } from './reducer.js';

/* --- SECTION: AUDIT BRIDGE --- */
let _lastAction = null;

export function _getLastAction() {
  const a = _lastAction;
  _lastAction = null;
  return a;
}

/* --- SECTION: DETERMINISTIC FIELD INJECTION --- */
function _newId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const _NEED_ID = new Set(['EVENT_ADD', 'TODO_ADD']);
const _NEED_TS = new Set(['MEMO_SET']);

function _inject(action) {
  const p = action.payload ?? {};
  if (_NEED_ID.has(action.type)) {
    return {
      ...action,
      payload: {
        id:        p.id        ?? _newId(action.type === 'EVENT_ADD' ? 'evt' : 'todo'),
        createdAt: p.createdAt ?? new Date().toISOString(),
        ...p,
      },
    };
  }
  if (_NEED_TS.has(action.type)) {
    return {
      ...action,
      payload: {
        updatedAt: p.updatedAt ?? new Date().toISOString(),
        ...p,
      },
    };
  }
  return action;
}

/* --- SECTION: DISPATCH --- */

/**
 * dispatch — 유일한 Snapshot 변경 진입점
 * @param {{ type: string, payload?: any }} action
 */
export function dispatch(action) {
  if (!action || typeof action.type !== 'string') {
    throw new Error(`[Dispatch] INVALID ACTION: ${JSON.stringify(action)}`);
  }

  // id/timestamp 주입 → audit event에 기록 → replay 시 동일 payload 재사용
  const a = _inject(action);
  _lastAction = a;

  const prev = getSnapshot();

  let nextData;
  try {
    nextData = reduce(a, prev ? prev.data : null);
  } catch(e) {
    _lastAction = null;
    throw new Error(`[Dispatch] ENGINE ERROR (${a.type}): ${e.message}`);
  }

  const next = prev
    ? updateSnapshot(prev, { data: nextData })
    : createSnapshot({ data: nextData });

  replaceSnapshot(next);
}

export { dispatch as auditDispatch };
