"use client";

type HistoricalTableSkeletonProps = {
  isAr?: boolean;
  yearCount?: number;
  metricCount?: number;
  rowCount?: number;
};

const HistoricalTableSkeleton = ({
  isAr = true,
  yearCount = 3,
  metricCount = 4,
  rowCount = 5,
}: HistoricalTableSkeletonProps) => {
  const cols = yearCount * metricCount;
  return (
    <div className="space-y-3 animate-pulse" dir={isAr ? "rtl" : "ltr"} aria-busy="true" aria-label={isAr ? "تحميل الجدول" : "Loading table"}>
      <div className="h-4 w-48 rounded bg-slate-200" />
      <div className="h-3 w-32 rounded bg-slate-100" />
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full table-fixed border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="h-10 w-[140px] border border-slate-100 bg-slate-100" rowSpan={2} />
              {Array.from({ length: yearCount }).map((_, yi) => (
                <th
                  key={`y-${yi}`}
                  colSpan={metricCount}
                  className="h-8 border border-slate-100 bg-slate-200"
                />
              ))}
            </tr>
            <tr>
              {Array.from({ length: cols }).map((_, ci) => (
                <th key={`m-${ci}`} className="h-6 w-14 border border-slate-100 bg-slate-100" />
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }).map((_, ri) => (
              <tr key={`r-${ri}`}>
                <td className="h-8 border border-slate-50 bg-slate-50" />
                {Array.from({ length: cols }).map((_, ci) => (
                  <td key={`c-${ri}-${ci}`} className="h-8 border border-slate-50 bg-white">
                    <div className="mx-auto h-3 w-8 rounded bg-slate-100" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoricalTableSkeleton;
