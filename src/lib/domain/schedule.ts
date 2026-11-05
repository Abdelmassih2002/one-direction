export interface TimeRange {
  start_at: string;
  end_at: string;
}

export interface OverlapResult<T extends TimeRange> {
  block: T;
  overlapSeconds: number;
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  const aStart = Date.parse(a.start_at);
  const aEnd = Date.parse(a.end_at);
  const bStart = Date.parse(b.start_at);
  const bEnd = Date.parse(b.end_at);
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false;
  return aStart < bEnd && bStart < aEnd;
}

export function findOverlaps<T extends TimeRange>(
  candidate: TimeRange,
  blocks: T[]
): OverlapResult<T>[] {
  return blocks
    .filter((block) => overlaps(candidate, block))
    .map((block) => ({
      block,
      overlapSeconds: Math.round(
        (Math.min(Date.parse(candidate.end_at), Date.parse(block.end_at)) -
          Math.max(Date.parse(candidate.start_at), Date.parse(block.start_at))) /
          1000
      ),
    }));
}

export function blockDurationSeconds(block: TimeRange): number {
  return Math.max(0, Math.round((Date.parse(block.end_at) - Date.parse(block.start_at)) / 1000));
}

/** Sorts blocks chronologically for the day view. */
export function sortBlocks<T extends TimeRange>(blocks: T[]): T[] {
  return [...blocks].sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
}
