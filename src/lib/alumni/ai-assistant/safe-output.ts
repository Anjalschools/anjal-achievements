/** Strip common PII patterns and cap length for alumni-facing AI output. */
export const sanitizeAlumniAiReply = (text: string, maxLen = 8000): string => {
  let s = text.trim();
  s = s.replace(/\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]");
  s = s.replace(/\b\d{10,16}\b/g, "[digits]");
  if (s.length > maxLen) s = `${s.slice(0, maxLen)}…`;
  return s;
};
