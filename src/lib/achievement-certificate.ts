import crypto from "crypto";

export const generateCertificateToken = (): string => {
  return crypto.randomBytes(24).toString("hex");
};

export const generateCertificateId = (): string => {
  return crypto.randomUUID();
};
