// app.js
// 업무Portal v2 Web — Entry Point
//
// 흐름:
//   bootstrap() → store/audit 복원 → render scheduler 연결 → 첫 render
//   이후 사용자 인터랙션은 dispatch() / uiStore.set()으로만 상태 변경

import { bootstrap }              from './core/bootstrap.js';
import { uiStore }                from './core/ui-store.js';
import { initRenderScheduler, forceRender } from './core/render-scheduler.js';
import { dispatch }               from './engine/dispatch.js';
import { save }                   from './core/persistence.js';
import { getSnapshot, store }     from './core/store.js';
import { getAuditLog }            from './audit/audit-store.js';

const el = (id) => document.getElementById(id);

/* --- SECTION: RENDER --- */

function render(snapshot, ui) {
  document.querySelectorAll('.view').forEach(v =>
    v.classList.toggle('hidden', v.dataset.view !== ui.activeTab));
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.view === ui.activeTab));

  if (!snapshot) return;

  if (ui.activeTab === 'calendar') renderCalendar(snapshot, ui);
  if (ui.activeTab === 'todo')     renderTodo(snapshot, ui);
  if (ui.activeTab === 'memo')     renderMemo(snapshot, ui);

  // persist (render와 독립적으로 자동 저장)
  save(snapshot, getAuditLog());
}

function renderCalendar(snapshot, ui) {
  const events = snapshot.data.calendar.events;
  const list = events.length
    ? events.map(e => `<div>${e.date} — ${escHtml(e.title)}</div>`).join('')
    : `<div class="empty-state">등록된 일정이 없습니다</div>`;
  el('view-calendar').innerHTML = `
    <button id="btn-add-event">+ 일정 추가</button>
    <div style="margin-top:12px">${list}</div>
  `;
  el('btn-add-event')?.addEventListener('click', () => {
    const title = prompt('일정 제목');
    if (!title) return;
    dispatch({ type: 'EVENT_ADD', payload: { title, date: ui.selectedDate } });
  });
}

function renderTodo(snapshot, ui) {
  const items = snapshot.data.todos.items;
  const list = items.length
    ? items.map(t => `
        <div>
          <input type="checkbox" data-id="${t.id}" ${t.done ? 'checked' : ''}>
          <span style="${t.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${escHtml(t.text)}</span>
        </div>`).join('')
    : `<div class="empty-state">할 일이 없습니다</div>`;
  el('view-todo').innerHTML = `
    <button id="btn-add-todo">+ 할 일 추가</button>
    <div style="margin-top:12px">${list}</div>
  `;
  el('btn-add-todo')?.addEventListener('click', () => {
    const text = prompt('할 일');
    if (!text) return;
    dispatch({ type: 'TODO_ADD', payload: { text, dueDate: ui.selectedDate } });
  });
  el('view-todo').querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      dispatch({ type: 'TODO_COMPLETE', payload: { id: cb.dataset.id, done: cb.checked } });
    });
  });
}

function renderMemo(snapshot, ui) {
  const memo = snapshot.data.memo.byDate[ui.selectedDate]?.content ?? '';
  el('view-memo').innerHTML = `
    <textarea id="memo-input" style="width:100%;height:300px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:12px">${escHtml(memo)}</textarea>
  `;
  let saveTimer = null;
  el('memo-input').addEventListener('input', (e) => {
    clearTimeout(saveTimer);
    const content = e.target.value;
    saveTimer = setTimeout(() => {
      dispatch({ type: 'MEMO_SET', payload: { date: ui.selectedDate, content } });
    }, 300);
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* --- SECTION: NAV BINDING --- */

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    uiStore.set({ activeTab: btn.dataset.view });
  });
});

/* --- SECTION: BOOT --- */

(async () => {
  const result = await bootstrap({
    initSchedulerFn: initRenderScheduler,
    uiStore,
    renderFn: render,
    forceRenderFn: forceRender,
  });
  console.info('[App] boot result:', result);
})();
