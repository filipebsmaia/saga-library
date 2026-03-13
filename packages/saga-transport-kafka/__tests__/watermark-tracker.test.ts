import { describe, it, expect } from 'vitest';
import { WatermarkTracker } from '../src/watermark-tracker';

describe('WatermarkTracker', () => {
  it('should return null when no offsets completed', () => {
    const tracker = new WatermarkTracker();
    tracker.reset(['0', '1', '2']);
    expect(tracker.getCommittableOffset()).toBeNull();
  });

  it('should return first offset when only first is completed', () => {
    const tracker = new WatermarkTracker();
    tracker.reset(['0', '1', '2']);
    tracker.markCompleted('0');
    expect(tracker.getCommittableOffset()).toBe('0');
  });

  it('should return last contiguous completed offset', () => {
    const tracker = new WatermarkTracker();
    tracker.reset(['0', '1', '2', '3']);
    tracker.markCompleted('0');
    tracker.markCompleted('1');
    tracker.markCompleted('2');
    expect(tracker.getCommittableOffset()).toBe('2');
  });

  it('should stop at gaps', () => {
    const tracker = new WatermarkTracker();
    tracker.reset(['0', '1', '2', '3']);
    tracker.markCompleted('0');
    tracker.markCompleted('2'); // gap at 1
    expect(tracker.getCommittableOffset()).toBe('0');
  });

  it('should handle out-of-order completion', () => {
    const tracker = new WatermarkTracker();
    tracker.reset(['0', '1', '2', '3']);
    tracker.markCompleted('2');
    tracker.markCompleted('0');
    tracker.markCompleted('1');
    // Now 0, 1, 2 are contiguous
    expect(tracker.getCommittableOffset()).toBe('2');
  });

  it('should return all completed when all are done in order', () => {
    const tracker = new WatermarkTracker();
    tracker.reset(['0', '1', '2']);
    tracker.markCompleted('0');
    tracker.markCompleted('1');
    tracker.markCompleted('2');
    expect(tracker.getCommittableOffset()).toBe('2');
  });

  it('should clear state on reset', () => {
    const tracker = new WatermarkTracker();
    tracker.reset(['0', '1']);
    tracker.markCompleted('0');
    tracker.markCompleted('1');
    expect(tracker.getCommittableOffset()).toBe('1');

    tracker.reset(['10', '11']);
    expect(tracker.getCommittableOffset()).toBeNull();
  });

  it('should return null for empty offsets', () => {
    const tracker = new WatermarkTracker();
    tracker.reset([]);
    expect(tracker.getCommittableOffset()).toBeNull();
  });
});
