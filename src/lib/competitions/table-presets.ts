/**
 * Metadata-driven competition table presets — column types, colors, row taxonomy.
 */

export type CompetitionTableType =
  | "medals"
  | "placements"
  | "olympiad_stages"
  | "nominations"
  | "acceptance"
  | "score_bands"
  | "special";

export type CompetitionColumnKey = string;

export type CompetitionColumnDef = {
  key: CompetitionColumnKey;
  labelAr: string;
  labelEn: string;
  /** Horizontal sum includes this column (medal totals exclude participation) */
  includeInRowTotal?: boolean;
  headerClass: string;
  cellClass: string;
};

export type CompetitionStageRowKey =
  | "primary_ar"
  | "primary_intl"
  | "middle_ar"
  | "middle_intl"
  | "secondary_ar"
  | "secondary_intl"
  | "total";

export type CompetitionStageRowDef = {
  key: CompetitionStageRowKey;
  labelAr: string;
  labelEn: string;
  stage: "primary" | "middle" | "secondary" | "all";
  section: "arabic" | "international" | "all";
  isTotal?: boolean;
};

/** Excel reference row order (primary ar → primary intl → …) */
export const EXCEL_STAGE_ROWS: CompetitionStageRowDef[] = [
  { key: "primary_ar", labelAr: "ابتدائي عربي", labelEn: "Primary Arabic", stage: "primary", section: "arabic" },
  { key: "primary_intl", labelAr: "ابتدائي دولي", labelEn: "Primary International", stage: "primary", section: "international" },
  { key: "middle_ar", labelAr: "متوسط عربي", labelEn: "Middle Arabic", stage: "middle", section: "arabic" },
  { key: "middle_intl", labelAr: "متوسط دولي", labelEn: "Middle International", stage: "middle", section: "international" },
  { key: "secondary_ar", labelAr: "ثانوي عربي", labelEn: "Secondary Arabic", stage: "secondary", section: "arabic" },
  { key: "secondary_intl", labelAr: "ثانوي دولي", labelEn: "Secondary International", stage: "secondary", section: "international" },
  {
    key: "total",
    labelAr: "المجموع",
    labelEn: "Total",
    stage: "all",
    section: "all",
    isTotal: true,
  },
];

const hdr = (bg: string, text: string) => `${bg} ${text} font-bold border border-slate-900`;
const cell = (bg: string) => `${bg} border border-slate-900 text-center tabular-nums`;

export const MEDAL_COLUMN_PRESET: CompetitionColumnDef[] = [
  {
    key: "participants",
    labelAr: "مشاركة",
    labelEn: "Participation",
    includeInRowTotal: false,
    headerClass: hdr("bg-slate-100", "text-slate-800"),
    cellClass: cell("bg-slate-50"),
  },
  {
    key: "gold",
    labelAr: "ذهبية",
    labelEn: "Gold",
    includeInRowTotal: true,
    headerClass: hdr("bg-amber-100", "text-amber-950"),
    cellClass: cell("bg-amber-50"),
  },
  {
    key: "silver",
    labelAr: "فضية",
    labelEn: "Silver",
    includeInRowTotal: true,
    headerClass: hdr("bg-slate-200", "text-slate-900"),
    cellClass: cell("bg-slate-100"),
  },
  {
    key: "bronze",
    labelAr: "برونزية",
    labelEn: "Bronze",
    includeInRowTotal: true,
    headerClass: hdr("bg-orange-100", "text-orange-950"),
    cellClass: cell("bg-orange-50"),
  },
  {
    key: "total",
    labelAr: "المجموع",
    labelEn: "Total",
    includeInRowTotal: false,
    headerClass: hdr("bg-rose-100", "text-rose-950"),
    cellClass: cell("bg-rose-50 font-semibold"),
  },
];

export const PLACEMENT_COLUMN_PRESET: CompetitionColumnDef[] = [
  {
    key: "participants",
    labelAr: "مشاركة",
    labelEn: "Participation",
    includeInRowTotal: false,
    headerClass: hdr("bg-slate-100", "text-slate-800"),
    cellClass: cell("bg-slate-50"),
  },
  {
    key: "first",
    labelAr: "مركز أول",
    labelEn: "First",
    includeInRowTotal: true,
    headerClass: hdr("bg-amber-100", "text-amber-950"),
    cellClass: cell("bg-amber-50"),
  },
  {
    key: "second",
    labelAr: "مركز ثاني",
    labelEn: "Second",
    includeInRowTotal: true,
    headerClass: hdr("bg-slate-200", "text-slate-900"),
    cellClass: cell("bg-slate-100"),
  },
  {
    key: "third",
    labelAr: "مركز ثالث",
    labelEn: "Third",
    includeInRowTotal: true,
    headerClass: hdr("bg-orange-100", "text-orange-950"),
    cellClass: cell("bg-orange-50"),
  },
  {
    key: "total",
    labelAr: "المجموع",
    labelEn: "Total",
    includeInRowTotal: false,
    headerClass: hdr("bg-rose-100", "text-rose-950"),
    cellClass: cell("bg-rose-50 font-semibold"),
  },
];

export const ACCEPTANCE_COLUMN_PRESET: CompetitionColumnDef[] = [
  {
    key: "participants",
    labelAr: "مشاركة",
    labelEn: "Participation",
    includeInRowTotal: false,
    headerClass: hdr("bg-slate-100", "text-slate-800"),
    cellClass: cell("bg-slate-50"),
  },
  {
    key: "accepted",
    labelAr: "قبول",
    labelEn: "Accepted",
    includeInRowTotal: true,
    headerClass: hdr("bg-emerald-100", "text-emerald-950"),
    cellClass: cell("bg-emerald-50"),
  },
  {
    key: "total",
    labelAr: "المجموع",
    labelEn: "Total",
    includeInRowTotal: false,
    headerClass: hdr("bg-rose-100", "text-rose-950"),
    cellClass: cell("bg-rose-50 font-semibold"),
  },
];

export const NOMINATION_COLUMN_PRESET: CompetitionColumnDef[] = [
  {
    key: "participants",
    labelAr: "مشاركة",
    labelEn: "Participation",
    includeInRowTotal: false,
    headerClass: hdr("bg-slate-100", "text-slate-800"),
    cellClass: cell("bg-slate-50"),
  },
  {
    key: "dhahranNomination",
    labelAr: "ترشيح الظهران",
    labelEn: "Dhahran nomination",
    includeInRowTotal: true,
    headerClass: hdr("bg-sky-100", "text-sky-950"),
    cellClass: cell("bg-sky-50"),
  },
  {
    key: "riyadhNomination",
    labelAr: "ترشيح الرياض",
    labelEn: "Riyadh nomination",
    includeInRowTotal: true,
    headerClass: hdr("bg-indigo-100", "text-indigo-950"),
    cellClass: cell("bg-indigo-50"),
  },
  {
    key: "isefNomination",
    labelAr: "ترشيح آيسف",
    labelEn: "ISEF nomination",
    includeInRowTotal: true,
    headerClass: hdr("bg-violet-100", "text-violet-950"),
    cellClass: cell("bg-violet-50"),
  },
  {
    key: "specialAward",
    labelAr: "جائزة خاصة",
    labelEn: "Special award",
    includeInRowTotal: true,
    headerClass: hdr("bg-amber-100", "text-amber-950"),
    cellClass: cell("bg-amber-50"),
  },
  {
    key: "total",
    labelAr: "المجموع",
    labelEn: "Total",
    includeInRowTotal: false,
    headerClass: hdr("bg-rose-100", "text-rose-950"),
    cellClass: cell("bg-rose-50 font-semibold"),
  },
];

export const columnPresetForType = (type: CompetitionTableType): CompetitionColumnDef[] => {
  if (type === "medals") return MEDAL_COLUMN_PRESET;
  if (type === "placements") return PLACEMENT_COLUMN_PRESET;
  if (type === "acceptance") return ACCEPTANCE_COLUMN_PRESET;
  if (type === "nominations") return NOMINATION_COLUMN_PRESET;
  if (type === "score_bands") return [];
  if (type === "olympiad_stages") return [];
  return MEDAL_COLUMN_PRESET;
};

export const buildScoreBandColumns = (bands: string[]): CompetitionColumnDef[] =>
  bands.map((b) => ({
    key: b,
    labelAr: b === "lessThan95" ? "أقل من 95" : b,
    labelEn: b === "lessThan95" ? "< 95" : b,
    includeInRowTotal: false,
    headerClass: hdr("bg-sky-100", "text-sky-950"),
    cellClass: cell("bg-sky-50"),
  }));

export const buildStageColumns = (
  stages: Array<{ key: string; labelAr: string; labelEn: string }>
): CompetitionColumnDef[] => [
  {
    key: "participants",
    labelAr: "مشاركة",
    labelEn: "Participation",
    includeInRowTotal: false,
    headerClass: hdr("bg-slate-100", "text-slate-800"),
    cellClass: cell("bg-slate-50"),
  },
  ...stages.map((s) => ({
    key: s.key,
    labelAr: s.labelAr,
    labelEn: s.labelEn,
    includeInRowTotal: true,
    headerClass: hdr("bg-sky-100", "text-sky-950"),
    cellClass: cell("bg-sky-50"),
  })),
  {
    key: "total",
    labelAr: "المجموع",
    labelEn: "Total",
    includeInRowTotal: false,
    headerClass: hdr("bg-rose-100", "text-rose-950"),
    cellClass: cell("bg-rose-50 font-semibold"),
  },
];
