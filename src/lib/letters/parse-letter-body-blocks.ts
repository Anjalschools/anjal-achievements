/**
 * Split letter body into layout blocks (paragraphs, bullet lines, etc.) for height-based pagination.
 */

const isBulletLine = (line: string): boolean => {
  const t = line.trim();
  return /^(?:[-•*]|\d+[\.)])\s/.test(t);
};

/**
 * Splits body text into blocks that should stay together when possible.
 * - Double newlines → paragraph boundaries
 * - Bullet / numbered lines → own blocks when inside a multi-line section
 */
export const parseLetterBodyIntoBlocks = (raw: string): string[] => {
  const text = raw.replace(/\r\n/g, "\n");
  if (!text.trim()) return [""];

  const blocks: string[] = [];
  const paras = text.split(/\n\s*\n/);

  for (const para of paras) {
    const p = para.trim();
    if (!p) continue;

    const lines = p.split("\n");
    if (lines.length === 1) {
      blocks.push(lines[0].trimEnd());
      continue;
    }

    let buf: string[] = [];
    const flush = () => {
      if (buf.length) {
        blocks.push(buf.join("\n").trimEnd());
        buf = [];
      }
    };

    for (const line of lines) {
      if (isBulletLine(line)) {
        flush();
        blocks.push(line.trimEnd());
      } else {
        buf.push(line);
      }
    }
    flush();
  }

  return blocks.length ? blocks : [""];
};
