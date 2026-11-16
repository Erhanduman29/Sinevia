import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startVisibilityAwareInterval } from '../hooks/useVisibleNow';

/** `document` yerine geçen, görünürlüğü elle değiştirilebilen sahte kaynak. */
class FakeVisibilitySource {
  visible = true;
  private listeners = new Set<() => void>();

  get visibilityState() {
    return this.visible ? 'visible' : 'hidden';
  }

  addEventListener(_type: 'visibilitychange', listener: () => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'visibilitychange', listener: () => void) {
    this.listeners.delete(listener);
  }

  setVisible(value: boolean) {
    this.visible = value;
    this.listeners.forEach((listener) => listener());
  }

  get listenerCount() {
    return this.listeners.size;
  }
}

describe('useVisibleNow / startVisibilityAwareInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('active=false iken hiç zamanlayıcı kurmaz ve dinleyici eklemez', () => {
    const source = new FakeVisibilitySource();
    const onTick = vi.fn();

    const cleanup = startVisibilityAwareInterval({ active: false, onTick, source });

    expect(onTick).not.toHaveBeenCalled();
    expect(source.listenerCount).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(onTick).not.toHaveBeenCalled();

    cleanup();
  });

  it('görünürken hemen bir kez tetikler ve her aralıkta tik atar', () => {
    const source = new FakeVisibilitySource();
    const onTick = vi.fn();

    const cleanup = startVisibilityAwareInterval({ active: true, intervalMs: 1000, onTick, source });

    expect(onTick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3000);
    expect(onTick).toHaveBeenCalledTimes(4);

    cleanup();
  });

  it('sekme gizlenince tik atmaz, geri dönünce anında tazeler', () => {
    const source = new FakeVisibilitySource();
    const onTick = vi.fn();

    const cleanup = startVisibilityAwareInterval({ active: true, intervalMs: 1000, onTick, source });
    expect(onTick).toHaveBeenCalledTimes(1);

    source.setVisible(false);
    vi.advanceTimersByTime(5000);
    expect(onTick).toHaveBeenCalledTimes(1);

    source.setVisible(true);
    expect(onTick).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(2000);
    expect(onTick).toHaveBeenCalledTimes(4);

    cleanup();
  });

  it('temizlik zamanlayıcıyı durdurur ve dinleyiciyi kaldırır', () => {
    const source = new FakeVisibilitySource();
    const onTick = vi.fn();

    const cleanup = startVisibilityAwareInterval({ active: true, intervalMs: 1000, onTick, source });
    cleanup();

    expect(source.listenerCount).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('gizli başlarsa hiç tik atmaz, görünür olunca başlar', () => {
    const source = new FakeVisibilitySource();
    source.visible = false;
    const onTick = vi.fn();

    const cleanup = startVisibilityAwareInterval({ active: true, intervalMs: 1000, onTick, source });
    expect(onTick).not.toHaveBeenCalled();

    source.setVisible(true);
    expect(onTick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(onTick).toHaveBeenCalledTimes(3);

    cleanup();
  });
});
