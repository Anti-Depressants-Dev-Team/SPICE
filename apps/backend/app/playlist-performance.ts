export const PLAYLIST_ROW_HEIGHT_PX = 72;
export const PLAYLIST_WINDOW_OVERSCAN_ROWS = 6;
export const MAX_REMEMBERED_PLAYBACK_QUEUE_ITEMS = 200;

export interface PlaylistWindowInput {
  itemCount: number;
  scrollOffset: number;
  viewportHeight: number;
  rowHeight?: number;
  overscan?: number;
}

export interface PlaylistWindow {
  startIndex: number;
  endIndex: number;
  renderedCount: number;
  paddingStart: number;
  paddingEnd: number;
  totalHeight: number;
}

const finiteInteger = (value: number, fallback: number) =>
  Number.isFinite(value) ? Math.floor(value) : fallback;

const positiveInteger = (value: number | undefined, fallback: number) => {
  const normalized = finiteInteger(value ?? fallback, fallback);
  return normalized > 0 ? normalized : fallback;
};

/**
 * Calculates an exclusive fixed-row render window for a long playlist.
 * The returned padding values preserve the full scroll range while the UI
 * mounts only the rows between startIndex and endIndex.
 */
export function computePlaylistWindow(input: PlaylistWindowInput): PlaylistWindow {
  const itemCount = Math.max(0, finiteInteger(input.itemCount, 0));
  const rowHeight = positiveInteger(input.rowHeight, PLAYLIST_ROW_HEIGHT_PX);
  const overscan = Math.max(
    0,
    finiteInteger(input.overscan ?? PLAYLIST_WINDOW_OVERSCAN_ROWS, PLAYLIST_WINDOW_OVERSCAN_ROWS),
  );
  const totalHeight = itemCount * rowHeight;

  if (itemCount === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      renderedCount: 0,
      paddingStart: 0,
      paddingEnd: 0,
      totalHeight: 0,
    };
  }

  // Always expose at least one row while a container is being measured.
  const viewportHeight = Math.max(
    rowHeight,
    finiteInteger(input.viewportHeight, rowHeight),
  );
  const maxScrollOffset = Math.max(0, totalHeight - viewportHeight);
  const scrollOffset = Math.min(
    maxScrollOffset,
    Math.max(0, finiteInteger(input.scrollOffset, 0)),
  );
  const firstVisibleIndex = Math.min(
    itemCount - 1,
    Math.floor(scrollOffset / rowHeight),
  );
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  const startIndex = Math.max(0, firstVisibleIndex - overscan);
  const endIndex = Math.min(itemCount, firstVisibleIndex + visibleCount + overscan);

  return {
    startIndex,
    endIndex,
    renderedCount: endIndex - startIndex,
    paddingStart: startIndex * rowHeight,
    paddingEnd: (itemCount - endIndex) * rowHeight,
    totalHeight,
  };
}

export interface CompactedPlaybackQueueWindow<T> {
  queue: T[];
  queueIndex: number;
  droppedBefore: number;
  droppedAfter: number;
}

/**
 * Selects a bounded queue window around the active item. This is used when
 * refreshing the metadata snapshot cache; the complete playback queue is
 * still persisted so restart and repeat behavior remain unchanged.
 */
export function compactPlaybackQueueWindow<T>(
  queue: readonly T[],
  queueIndex: number,
  maxItems = MAX_REMEMBERED_PLAYBACK_QUEUE_ITEMS,
): CompactedPlaybackQueueWindow<T> {
  if (queue.length === 0) {
    return {
      queue: [],
      queueIndex: 0,
      droppedBefore: 0,
      droppedAfter: 0,
    };
  }

  const boundedMaxItems = positiveInteger(maxItems, MAX_REMEMBERED_PLAYBACK_QUEUE_ITEMS);
  const activeIndex = Math.min(
    queue.length - 1,
    Math.max(0, finiteInteger(queueIndex, 0)),
  );
  const retainedCount = Math.min(queue.length, boundedMaxItems);
  const preferredItemsBefore = Math.floor((retainedCount - 1) / 2);
  const maxStartIndex = queue.length - retainedCount;
  const startIndex = Math.min(
    maxStartIndex,
    Math.max(0, activeIndex - preferredItemsBefore),
  );
  const endIndex = startIndex + retainedCount;

  return {
    queue: queue.slice(startIndex, endIndex),
    queueIndex: activeIndex - startIndex,
    droppedBefore: startIndex,
    droppedAfter: queue.length - endIndex,
  };
}
