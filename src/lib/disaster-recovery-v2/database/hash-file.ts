import { createHash } from "crypto";
import { createReadStream } from "fs";

export const computeFileSha256 = async (filePath: string): Promise<string> => {
  const hash = createHash("sha256");

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => {
      hash.update(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });

  return hash.digest("hex");
};
