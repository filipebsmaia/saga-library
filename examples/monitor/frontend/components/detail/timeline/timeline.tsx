"use client";

import { useState, useMemo, useCallback } from "react";
import { SagaEventDto, EventHint, SagaPredictionsDto } from "@/lib/types/saga";
import { StatusBadge } from "@/components/shared/status-badge/status-badge";
import { HintBadge } from "@/components/shared/hint-badge/hint-badge";
import { CopyButton } from "@/components/shared/copy-button/copy-button";
import { formatTimestamp, cn } from "@/lib/utils/format";
import { Skeleton } from "@/components/shared/skeleton/skeleton";
import { EmptyState } from "@/components/shared/empty-state/empty-state";
import styles from "./timeline.module.scss";

/** A node in the hierarchical timeline tree */
interface TimelineNode {
  event: SagaEventDto;
  /** Nested child saga events (only present on fork events) */
  children: TimelineNode[];
  depth: number;
}

/**
 * Builds a hierarchical timeline: fork events contain their child saga events as children.
 * Events within each saga are ordered chronologically. Child saga events are nested
 * under the fork event that triggered them.
 */
function buildTimelineTree(events: SagaEventDto[]): TimelineNode[] {
  // Group events by sagaId
  const bySaga = new Map<string, SagaEventDto[]>();
  for (const e of events) {
    const list = bySaga.get(e.sagaId) ?? [];
    list.push(e);
    bySaga.set(e.sagaId, list);
  }
  // Sort each group chronologically
  for (const [, list] of bySaga) {
    list.sort(
      (a, b) =>
        new Date(a.sagaPublishedAt).getTime() -
        new Date(b.sagaPublishedAt).getTime(),
    );
  }

  // Build parent→children saga map
  const childSagaIds = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.sagaParentId && e.sagaParentId !== e.sagaId) {
      const set = childSagaIds.get(e.sagaParentId) ?? new Set();
      set.add(e.sagaId);
      childSagaIds.set(e.sagaParentId, set);
    }
  }

  // Find root sagaId (the one with no parent or self-referencing)
  const allSagaIds = new Set(bySaga.keys());
  let rootSagaId: string | null = null;
  for (const e of events) {
    if (!e.sagaParentId || e.sagaParentId === e.sagaId) {
      rootSagaId = e.sagaId;
      break;
    }
  }
  if (!rootSagaId) rootSagaId = events[0]?.sagaId ?? "";

  // Track which child sagas have been placed under a fork
  const placedSagas = new Set<string>();

  /**
   * Build nodes for a saga. If isChildSaga is true, the first event becomes a
   * header node and the remaining events are nested as its children (indented).
   */
  function buildNodes(
    sagaId: string,
    depth: number,
    isChildSaga = false,
  ): TimelineNode[] {
    const sagaEvents = bySaga.get(sagaId) ?? [];
    const children = childSagaIds.get(sagaId) ?? new Set<string>();

    // Map child saga to the fork event that triggered it
    const forkToChildSaga = new Map<string, string[]>();
    for (const childId of children) {
      if (placedSagas.has(childId)) continue;
      const childEvents = bySaga.get(childId);
      if (!childEvents || childEvents.length === 0) continue;
      const causationId = childEvents[0].sagaCausationId;
      const list = forkToChildSaga.get(causationId) ?? [];
      list.push(childId);
      forkToChildSaga.set(causationId, list);
    }

    const nodes: TimelineNode[] = [];
    for (const event of sagaEvents) {
      const childSagaIdsForFork = forkToChildSaga.get(event.sagaEventId) ?? [];
      const childNodes: TimelineNode[] = [];

      for (const childSagaId of childSagaIdsForFork) {
        placedSagas.add(childSagaId);
        childNodes.push(...buildNodes(childSagaId, depth + 1, true));
      }

      nodes.push({ event, children: childNodes, depth });
    }

    // Orphan child sagas → attach as children of the last node
    for (const childId of children) {
      if (placedSagas.has(childId)) continue;
      placedSagas.add(childId);
      const orphanNodes = buildNodes(childId, depth + 1, true);
      if (nodes.length > 0) {
        nodes[nodes.length - 1].children.push(...orphanNodes);
      } else {
        nodes.push(...orphanNodes);
      }
    }

    // For child sagas: first event stays at current depth,
    // remaining events become children of the first (indented one more level)
    if (isChildSaga && nodes.length > 1) {
      const [first, ...rest] = nodes;
      // Nest the remaining events under the first, bumping their depth
      const nested = rest.map((n) => bumpDepth(n, 1));
      first.children = [...nested, ...first.children];
      return [first];
    }

    return nodes;
  }

  /** Recursively increase depth of a node and its children */
  function bumpDepth(node: TimelineNode, amount: number): TimelineNode {
    return {
      ...node,
      depth: node.depth + amount,
      children: node.children.map((c) => bumpDepth(c, amount)),
    };
  }

  return buildNodes(rootSagaId, 0);
}

interface TimelineProps {
  events: SagaEventDto[];
  recentEventIds?: Set<string>;
  selectedEventId?: string;
  onSelectEvent?: (eventId: string) => void;
  predictions?: SagaPredictionsDto;
}

export function Timeline({
  events,
  recentEventIds,
  selectedEventId,
  onSelectEvent,
  predictions,
}: TimelineProps) {
  const [hintFilter, setHintFilter] = useState<EventHint | "">("");
  const [stepFilter, setStepFilter] = useState("");
  const [collapsedForks, setCollapsedForks] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildTimelineTree(events), [events]);

  const toggleFork = useCallback((eventId: string) => {
    setCollapsedForks((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }, []);

  // Flatten tree respecting collapsed state and filters
  // Each item includes connector info for tree rendering
  const flatList = useMemo(() => {
    const result: { node: TimelineNode; isLast: boolean; guides: boolean[] }[] =
      [];

    function walk(nodes: TimelineNode[], guides: boolean[]) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const isLast = i === nodes.length - 1;

        // Apply filters
        let matchesFilter = true;
        if (hintFilter && node.event.sagaEventHint !== hintFilter)
          matchesFilter = false;
        if (
          stepFilter &&
          !node.event.sagaStepName
            .toLowerCase()
            .includes(stepFilter.toLowerCase())
        )
          matchesFilter = false;

        if (matchesFilter) result.push({ node, isLast, guides: [...guides] });

        // If this node has children (fork with child saga events)
        if (node.children.length > 0) {
          const isCollapsed = collapsedForks.has(node.event.sagaEventId);
          if (!isCollapsed) {
            walk(node.children, [...guides, !isLast]);
          }
        }
      }
    }

    walk(tree, []);
    return result;
  }, [tree, hintFilter, stepFilter, collapsedForks]);

  return (
    <div className={styles.container}>
      <div className={styles.filters}>
        <select
          className={styles.filterSelect}
          value={hintFilter}
          onChange={(e) => setHintFilter(e.target.value as EventHint | "")}
        >
          <option value="">All hints</option>
          <option value="step">step</option>
          <option value="compensation">compensation</option>
          <option value="final">final</option>
          <option value="fork">fork</option>
        </select>
        <input
          className={styles.filterInput}
          placeholder="Filter by step..."
          value={stepFilter}
          onChange={(e) => setStepFilter(e.target.value)}
        />
        <span className={styles.count}>{flatList.length} events</span>
      </div>

      <div className={styles.timeline}>
        {flatList.map(({ node, isLast, guides }) => {
          const { event, depth } = node;
          const isRecent = recentEventIds?.has(event.sagaEventId);
          const isSelected = selectedEventId === event.sagaEventId;
          const hasForkChildren = node.children.length > 0;
          const isCollapsed = collapsedForks.has(event.sagaEventId);
          const isLastReal =
            isLast && (!predictions || predictions.expectedChain.length === 0);

          return (
            <TimelineEventRow
              key={event.sagaEventId}
              event={event}
              depth={depth}
              isLast={isLastReal}
              guides={guides}
              isRecent={isRecent}
              isSelected={isSelected}
              hasForkChildren={hasForkChildren}
              isCollapsed={isCollapsed}
              onToggleFork={
                hasForkChildren
                  ? () => toggleFork(event.sagaEventId)
                  : undefined
              }
              onClick={() => onSelectEvent?.(event.sagaEventId)}
            />
          );
        })}

        {predictions &&
          (predictions.nextPossible.length > 0 ||
            predictions.expectedChain.length > 0) && (
            <>
              <div className={styles.predictedDivider}>
                <span className={styles.predictedDividerLabel}>
                  Predicted next steps
                </span>
                <span className={styles.predictedDividerMeta}>
                  based on {predictions.sampleSize} completed saga
                  {predictions.sampleSize !== 1 ? "s" : ""}
                </span>
              </div>

              {/* All possible next events (immediate alternatives) */}
              {predictions.nextPossible.map((predicted, i) => {
                const isOnlySection = predictions.expectedChain.length <= 1;
                const isLast =
                  isOnlySection && i === predictions.nextPossible.length - 1;
                return (
                  <div
                    key={`next-${i}`}
                    className={cn(styles.event, styles.predicted)}
                  >
                    <div className={styles.treePrefix}>
                      <span
                        className={cn(
                          styles.connectorSegment,
                          styles.connectorDashed,
                          isLast && styles.connectorLast,
                        )}
                      />
                    </div>
                    <div className={styles.eventContent}>
                      <div className={styles.eventHeader}>
                        <span
                          className={styles.eventDotInline}
                          data-hint="expected"
                        />
                        <span className={styles.eventStep}>
                          {predicted.stepName}
                        </span>
                        {predicted.eventHint && (
                          <HintBadge hint={predicted.eventHint as EventHint} />
                        )}
                        {predicted.topic && (
                          <span className={styles.eventTopic}>
                            {predicted.topic}
                          </span>
                        )}
                        <span className={styles.predictedProbability}>
                          {Math.round(predicted.probability * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Most probable path (remaining steps after the first) */}
              {predictions.expectedChain.slice(1).map((predicted, i, arr) => (
                <div
                  key={`chain-${i}`}
                  className={cn(styles.event, styles.predicted)}
                >
                  <div className={styles.treePrefix}>
                    <span
                      className={cn(
                        styles.connectorSegment,
                        styles.connectorDashed,
                        i === arr.length - 1 && styles.connectorLast,
                      )}
                    />
                  </div>
                  <div className={styles.eventContent}>
                    <div className={styles.eventHeader}>
                      <span
                        className={styles.eventDotInline}
                        data-hint="expected"
                      />
                      <span className={styles.eventStep}>
                        {predicted.stepName}
                      </span>
                      {predicted.eventHint && (
                        <HintBadge hint={predicted.eventHint as EventHint} />
                      )}
                      {predicted.topic && (
                        <span className={styles.eventTopic}>
                          {predicted.topic}
                        </span>
                      )}
                      <span className={styles.predictedProbability}>
                        {Math.round(predicted.probability * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
      </div>
    </div>
  );
}

interface TimelineEventRowProps {
  event: SagaEventDto;
  depth: number;
  isLast: boolean;
  guides: boolean[];
  isRecent?: boolean;
  isSelected?: boolean;
  hasForkChildren?: boolean;
  isCollapsed?: boolean;
  onToggleFork?: () => void;
  onClick?: () => void;
}

function TimelineEventRow({
  event,
  depth,
  isLast,
  guides,
  isRecent,
  isSelected,
  hasForkChildren,
  isCollapsed,
  onToggleFork,
  onClick,
}: TimelineEventRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        styles.event,
        isRecent && styles.recent,
        isSelected && styles.selected,
      )}
      onClick={onClick}
    >
      <div className={styles.treePrefix}>
        {guides.map((active, i) => (
          <span
            key={i}
            className={cn(styles.guideSegment, active && styles.guideActive)}
          />
        ))}
        <span
          className={cn(
            styles.connectorSegment,
            isLast && styles.connectorLast,
          )}
        />
      </div>

      <div className={styles.eventContent}>
        <div className={styles.eventHeader}>
          {hasForkChildren && (
            <button
              className={styles.forkToggle}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFork?.();
              }}
              title={isCollapsed ? "Expand fork" : "Collapse fork"}
            >
              {isCollapsed ? "▸" : "▾"}
            </button>
          )}
          <span
            className={styles.eventDotInline}
            data-hint={event.sagaEventHint ?? "step"}
          />
          <span className={styles.eventTime}>
            {formatTimestamp(event.sagaPublishedAt)}
          </span>
          <HintBadge hint={event.sagaEventHint} />
          <span className={styles.eventStep}>{event.sagaStepName}</span>
          {event.topic && (
            <span className={styles.eventTopic}>{event.topic}</span>
          )}
          {depth > 0 && event.sagaName && (
            <span className={styles.sagaLabel}>{event.sagaName}</span>
          )}
          {event.statusBefore &&
            event.statusAfter &&
            event.statusBefore !== event.statusAfter && (
              <span className={styles.transition}>
                <StatusBadge status={event.statusBefore} size="sm" />
                <span className={styles.arrow}>→</span>
                <StatusBadge status={event.statusAfter} size="sm" />
              </span>
            )}
          {hasForkChildren && isCollapsed && (
            <span className={styles.collapsedCount}>
              ({countDescendants(event)} collapsed)
            </span>
          )}
        </div>

        {event.sagaStepDescription && (
          <p className={styles.eventDescription}>{event.sagaStepDescription}</p>
        )}

        <button
          className={styles.expandBtn}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? "▾ Hide details" : "▸ Details"}
        </button>

        {expanded && (
          <div className={styles.details}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Step</span>
              <span className={styles.detailValue}>{event.sagaStepName}</span>
            </div>
            {event.sagaStepDescription && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Description</span>
                <span className={styles.detailValue}>
                  {event.sagaStepDescription}
                </span>
              </div>
            )}
            {event.sagaEventHint && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Hint</span>
                <span className={styles.detailValue}>
                  {event.sagaEventHint}
                </span>
              </div>
            )}
            {event.sagaName && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Saga Name</span>
                <span className={styles.detailValue}>{event.sagaName}</span>
              </div>
            )}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Status</span>
              <span className={styles.detailValue}>
                {event.statusBefore && event.statusBefore !== event.statusAfter
                  ? `${event.statusBefore} → ${event.statusAfter}`
                  : event.statusAfter}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Published At</span>
              <span className={styles.detailValue}>
                {event.sagaPublishedAt}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Event ID</span>
              <CopyButton
                text={event.sagaEventId}
                displayText={event.sagaEventId}
              />
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Causation ID</span>
              <CopyButton
                text={event.sagaCausationId}
                displayText={event.sagaCausationId}
              />
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Saga ID</span>
              <CopyButton text={event.sagaId} displayText={event.sagaId} />
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Root ID</span>
              <CopyButton
                text={event.sagaRootId}
                displayText={event.sagaRootId}
              />
            </div>
            {event.sagaParentId && event.sagaParentId !== event.sagaId && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Parent ID</span>
                <CopyButton
                  text={event.sagaParentId}
                  displayText={event.sagaParentId}
                />
              </div>
            )}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Topic</span>
              <span className={styles.detailValue}>{event.topic}</span>
            </div>
            {event.partition !== null && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Partition / Offset</span>
                <span className={styles.detailValue}>
                  {event.partition} / {event.offset}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Placeholder for collapsed count — we don't have the tree here, so return empty string for now */
function countDescendants(_event: SagaEventDto): string {
  return "...";
}

export function TimelineLoading() {
  return (
    <div className={styles.container}>
      <div className={styles.timeline}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={styles.event}
            style={{ opacity: 1 - i * 0.1 }}
          >
            <div className={styles.treePrefix}>
              <span
                className={cn(
                  styles.connectorSegment,
                  i === 5 && styles.connectorLast,
                )}
              />
            </div>
            <div className={styles.eventContent}>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  alignItems: "center",
                }}
              >
                <Skeleton variant="line" width="70px" height="14px" />
                <Skeleton variant="badge" width="50px" />
                <Skeleton variant="line" width="120px" height="14px" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimelineEmpty() {
  return (
    <EmptyState
      title="No events"
      description="No events have been recorded for this saga yet."
    />
  );
}
