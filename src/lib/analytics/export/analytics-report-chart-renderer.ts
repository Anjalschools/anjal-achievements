/** SVG-free chart placeholders for PDF (print-safe bars). */

export const renderMiniBarSvg = (input: {
  label: string;
  value: number;
  max: number;
  fill?: string;
}): string => {
  const pct = input.max > 0 ? Math.min(100, Math.round((input.value / input.max) * 100)) : 0;
  const fill = input.fill ?? "#4f46e5";
  return `<div class="mini-bar" style="margin:4px 0">
    <div style="font-size:9px;margin-bottom:2px">${input.label} <span style="float:inline-end">${input.value}</span></div>
    <div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
      <div style="width:${pct}%;height:100%;background:${fill}"></div>
    </div>
  </div>`;
};
