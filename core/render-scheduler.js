// core/render-scheduler.js
// 업무Portal v2 Web — Render Scheduler (Kernel)
//
// 규칙:
//   render는 항상 단일 진입점 (render(snapshot, ui))
//   같은 tick에 snapshot + ui 동시 변경 → render 1회만 실행
//   render 내부에서 상태 변경 절대 금지
//   store 순환 참조 방지 — store는 init() 시점에 주입

/* --- SECTION: STATE --- */
let _store    = null;
let _uiStore  = null;
let _renderFn = null;
let _pending  = false;

/* --- SECTION: SCHEDULER --- */
function _scheduleRender() {
  if (_pending) return;          // 같은 tick 중복 방지
  _pending = true;

  queueMicrotask(() => {
    _pending = false;

    if (!_renderFn) {
      console.warn('[RenderScheduler] renderFn not set');
      return;
    }

    const snapshot = _store.getSnapshot();
    const ui       = _uiStore.get();

    try {
      _renderFn(snapshot, ui);
    } catch(e) {
      console.error('[RenderScheduler] render error:', e);
    }
  });
}

/* --- SECTION: API --- */

/**
 * init — 앱 부팅 시 1회 호출
 * @param {object} store    - core/store.js (getSnapshot, subscribe)
 * @param {object} uiStore  - core/ui-store.js (get, subscribe)
 * @param {Function} renderFn - render(snapshot, ui)
 */
export function initRenderScheduler(store, uiStore, renderFn) {
  if (_store) {
    console.warn('[RenderScheduler] already initialized — skipping');
    return;
  }

  _store    = store;
  _uiStore  = uiStore;
  _renderFn = renderFn;

  // 두 store 모두 scheduleRender만 호출
  // → 같은 tick에 둘 다 변경돼도 render는 1회
  _store.subscribe(_scheduleRender);
  _uiStore.subscribe(_scheduleRender);

  console.info('[RenderScheduler] initialized');
}

/**
 * forceRender — 초기 부팅 시 또는 테스트용 즉시 render
 * (microtask 없이 동기 실행)
 */
export function forceRender() {
  if (!_renderFn || !_store || !_uiStore) {
    console.warn('[RenderScheduler] not initialized');
    return;
  }
  _renderFn(_store.getSnapshot(), _uiStore.get());
}

/**
 * scheduleRender — 외부에서 명시적으로 render 예약 필요할 때
 * (일반적으로 store.subscribe 자동 트리거로 충분)
 */
export { _scheduleRender as scheduleRender };
