export const formatRelativeTime = (iso: string, isAr: boolean): string => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (isAr) {
    if (sec < 60) return "الآن";
    if (min < 60) return `منذ ${min} د`;
    if (hr < 24) return `منذ ${hr} س`;
    if (day < 7) return `منذ ${day} يوم`;
    return new Date(iso).toLocaleDateString("ar-SA", { dateStyle: "medium" });
  }
  if (sec < 60) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" });
};
