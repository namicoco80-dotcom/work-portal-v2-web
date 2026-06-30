// engine/reducer.js
// 업무Portal v2 Web — Pure Reducer
//
// 규칙:
//   순수 함수만 — side-effect, I/O, 날짜 직접 생성 금지
//   동일 (action, data) → 동일 result (deterministic)
//   unknown action → FAIL FAST (silent ignore 금지)
//   data mutation 금지 — 항상 새 객체 반환

/* --- SECTION: ID FACTORY --- */
function newId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/* --- SECTION: INITIAL STATE --- */
function initialData() {
  return {
    calendar: { events: [] },
    todos:    { items:  [] },
    memo:     { byDate: {} },
    settings: {},
  };
}

/* --- SECTION: REDUCERS (domain별) --- */

function calendarReducer(state = { events: [] }, action) {
  switch (action.type) {

    case 'EVENT_ADD': {
      const { id, title, date, time = null, note = '', createdAt } = action.payload;
      if (!title || !date) throw new Error('EVENT_ADD: title, date required');
      return {
        events: [
          ...state.events,
          {
            id:        id        ?? newId('evt'),
            title, date, time, note,
            createdAt: createdAt ?? new Date().toISOString(),
          },
        ],
      };
    }

    case 'EVENT_DELETE': {
      const { id } = action.payload;
      return { events: state.events.filter(e => e.id !== id) };
    }

    case 'EVENT_UPDATE': {
      const { id, ...patch } = action.payload;
      return {
        events: state.events.map(e => e.id === id ? { ...e, ...patch } : e),
      };
    }

    default:
      return state;
  }
}

function todosReducer(state = { items: [] }, action) {
  switch (action.type) {

    case 'TODO_ADD': {
      const { id, text, dueDate = null, priority = 'normal', createdAt } = action.payload;
      if (!text) throw new Error('TODO_ADD: text required');
      return {
        items: [
          ...state.items,
          {
            id:        id        ?? newId('todo'),
            text, dueDate, priority, done: false,
            createdAt: createdAt ?? new Date().toISOString(),
          },
        ],
      };
    }

    case 'TODO_COMPLETE': {
      const { id, done } = action.payload;
      return {
        items: state.items.map(t => t.id === id ? { ...t, done } : t),
      };
    }

    case 'TODO_DELETE': {
      const { id } = action.payload;
      return { items: state.items.filter(t => t.id !== id) };
    }

    case 'TODO_CLEAR_DONE': {
      return { items: state.items.filter(t => !t.done) };
    }

    default:
      return state;
  }
}

function memoReducer(state = { byDate: {} }, action) {
  switch (action.type) {

    case 'MEMO_SET': {
      const { date, content, updatedAt } = action.payload;
      if (!date) throw new Error('MEMO_SET: date required');
      const byDate = { ...state.byDate };
      if (content === '' || content == null) {
        delete byDate[date];
      } else {
        byDate[date] = { content, updatedAt: updatedAt ?? new Date().toISOString() };
      }
      return { byDate };
    }

    default:
      return state;
  }
}

function settingsReducer(state = {}, action) {
  switch (action.type) {
    case 'SETTINGS_SET':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

/* --- SECTION: KNOWN ACTIONS (fail-fast guard) --- */
const KNOWN_ACTIONS = new Set([
  'EVENT_ADD', 'EVENT_DELETE', 'EVENT_UPDATE',
  'TODO_ADD', 'TODO_COMPLETE', 'TODO_DELETE', 'TODO_CLEAR_DONE',
  'MEMO_SET',
  'SETTINGS_SET',
  'SNAPSHOT_RESTORE',             // persistence 복원 전용
]);

/* --- SECTION: ROOT REDUCER --- */

/**
 * reduce — pure: (action, prevData) → nextData
 * @param {{ type: string, payload?: any }} action
 * @param {object|null} prevData - Snapshot.data (null = 초기화)
 * @returns {object} nextData
 */
export function reduce(action, prevData) {
  // fail-fast: unknown action
  if (!KNOWN_ACTIONS.has(action.type)) {
    throw new Error(`[Reducer] UNKNOWN ACTION: "${action.type}"`);
  }

  // SNAPSHOT_RESTORE: Engine 통과 없이 payload를 data로 직접 사용
  if (action.type === 'SNAPSHOT_RESTORE') {
    if (!action.payload?.data) throw new Error('[Reducer] SNAPSHOT_RESTORE: missing payload.data');
    return action.payload.data;
  }

  const data = prevData ?? initialData();

  return {
    calendar: calendarReducer(data.calendar, action),
    todos:    todosReducer(data.todos, action),
    memo:     memoReducer(data.memo, action),
    settings: settingsReducer(data.settings, action),
  };
}
