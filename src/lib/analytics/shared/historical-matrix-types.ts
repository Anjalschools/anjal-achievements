/**
 * Shared matrix model type — dependency leaf.
 */

export type MatrixTableModel = {
  id: string;
  rowLabels: Array<{ key: string; labelAr: string; labelEn: string }>;
  columnLabels: Array<{ key: string; labelAr: string; labelEn: string }>;
  cells: Record<string, Record<string, number>>;
};

