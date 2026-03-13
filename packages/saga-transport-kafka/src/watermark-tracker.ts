export class WatermarkTracker {
  private arrivedOffsets: string[] = [];
  private completed = new Set<string>();

  reset(offsets: string[]): void {
    this.arrivedOffsets = offsets;
    this.completed.clear();
  }

  markCompleted(offset: string): void {
    this.completed.add(offset);
  }

  getCommittableOffset(): string | null {
    let lastSafe: string | null = null;
    for (const offset of this.arrivedOffsets) {
      if (this.completed.has(offset)) {
        lastSafe = offset;
      } else {
        break;
      }
    }
    return lastSafe;
  }
}
