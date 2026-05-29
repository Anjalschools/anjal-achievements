"use client";

import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export type VirtualizedTableBodyProps<T> = {
  rows: T[];
  rowKey: (row: T, index: number) => string;
  renderRow: (row: T, index: number, opts?: { measureRef?: (el: Element | null) => void }) => ReactNode;
  colSpan: number;
  emptyMessage: string;
  /** Minimum rows before virtualization kicks in */
  threshold?: number;
  estimateRowHeight?: number;
};

const VirtualizedTableBody = <T,>({
  rows,
  rowKey,
  renderRow,
  colSpan,
  emptyMessage,
  threshold = 40,
  estimateRowHeight = 38,
}: VirtualizedTableBodyProps<T>) => {
  if (rows.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={colSpan} className="px-2 py-8 text-center text-slate-500">
            {emptyMessage}
          </td>
        </tr>
      </tbody>
    );
  }

  if (rows.length < threshold) {
    return <tbody>{rows.map((row, i) => renderRow(row, i))}</tbody>;
  }

  return (
    <VirtualizedTableBodyInner
      rows={rows}
      rowKey={rowKey}
      renderRow={renderRow}
      colSpan={colSpan}
      estimateRowHeight={estimateRowHeight}
    />
  );
};

const VirtualizedTableBodyInner = <T,>({
  rows,
  rowKey,
  renderRow,
  colSpan,
  estimateRowHeight,
}: Omit<VirtualizedTableBodyProps<T>, "threshold" | "emptyMessage"> & {
  estimateRowHeight: number;
}) => {
  const parentRef = useRef<HTMLTableSectionElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current?.closest("[data-virtual-scroll]") ?? null,
    estimateSize: () => estimateRowHeight,
    overscan: 10,
  });

  const items = virtualizer.getVirtualItems();
  const paddingTop = items.length > 0 ? items[0]!.start : 0;
  const paddingBottom =
    items.length > 0 ? virtualizer.getTotalSize() - items[items.length - 1]!.end : 0;

  return (
    <tbody ref={parentRef}>
      {paddingTop > 0 ? (
        <tr aria-hidden>
          <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 0 }} />
        </tr>
      ) : null}
      {items.map((vi) => {
        const row = rows[vi.index]!;
        return renderRow(row, vi.index, { measureRef: virtualizer.measureElement });
      })}
      {paddingBottom > 0 ? (
        <tr aria-hidden>
          <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: 0 }} />
        </tr>
      ) : null}
    </tbody>
  );
};

export default VirtualizedTableBody;
