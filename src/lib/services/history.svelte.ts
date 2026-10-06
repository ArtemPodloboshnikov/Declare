/**
 * Простая история снимков для отмены/повтора.
 * Работает с любым сериализуемым состоянием.
 */
export function createHistory<T>(initial: T, limit = 50) {
  let past = $state<T[]>([]);
  let future = $state<T[]>([]);
  let present = $state<T>(initial);

  // Защита от зацикливания: пока true, эффекты не пишут в историю
  let internal = false;

  return {
    get present() { return present; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },

    /** Сохраняет текущее состояние в past и устанавливает новое */
    commit(next: T) {
      if (internal) {
        present = next;
        return;
      }
      past.push(present);
      if (past.length > limit) past.shift();
      present = next;
      future = [];
    },

    /** Откат на шаг назад */
    undo() {
      if (!past.length) return;
      const prev = past.pop()!;
      future.push(present);
      internal = true;
      present = prev;
      internal = false;
    },

    /** Повтор отменённого действия */
    redo() {
      if (!future.length) return;
      const next = future.pop()!;
      past.push(present);
      internal = true;
      present = next;
      internal = false;
    },

    /** Сброс истории (например, при загрузке нового проекта) */
    reset(state: T) {
      past = [];
      future = [];
      present = state;
    },

    /**
     * Устанавливает состояние без записи в историю.
     * Нужно при программных изменениях, которые не должны попадать в undo.
     */
    setSilent(state: T) {
      internal = true;
      present = state;
      internal = false;
    }
  };
}
