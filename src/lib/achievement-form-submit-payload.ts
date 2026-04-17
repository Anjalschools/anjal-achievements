/**
 * Builds the JSON body for POST/PUT /api/achievements from the same shape
 * `AchievementForm` passes to `onSubmit`. Used by student and admin manual flows.
 *
 * Images: new `File` values are uploaded via POST /api/uploads/image (Cloudinary);
 * stored in MongoDB as URL strings only, not base64.
 *
 * Attachments: new `File` values are uploaded via POST /api/uploads/attachment (R2).
 * Legacy string URLs and existing object descriptors are forwarded as-is (no base64).
 *
 * TODO: optional future metadata (checksum, virus-scan status, version id) on attachment objects.
 */

const uploadAchievementImageClient = async (
  file: File
): Promise<{ url: string; publicId: string }> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/uploads/image", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof data.error === "string" ? data.error : "Image upload failed";
    throw new Error(msg);
  }
  if (data.ok !== true || typeof data.url !== "string" || !String(data.url).trim()) {
    throw new Error("Invalid image upload response");
  }
  const publicId = typeof data.publicId === "string" ? data.publicId.trim() : "";
  return { url: String(data.url).trim(), publicId };
};

const uploadAchievementAttachmentClient = async (
  file: File
): Promise<{
  url: string;
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
  provider: string;
}> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/uploads/attachment", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof data.error === "string" ? data.error : "Attachment upload failed";
    throw new Error(msg);
  }
  if (data.ok !== true || typeof data.url !== "string" || !String(data.url).trim()) {
    throw new Error("Invalid attachment upload response");
  }
  return {
    url: String(data.url).trim(),
    key: typeof data.key === "string" ? data.key : "",
    fileName: typeof data.fileName === "string" && data.fileName.trim() ? data.fileName : file.name,
    mimeType: typeof data.mimeType === "string" && data.mimeType.trim() ? data.mimeType : file.type || "application/octet-stream",
    size: typeof data.size === "number" && Number.isFinite(data.size) ? data.size : file.size,
    provider: typeof data.provider === "string" && data.provider.trim() ? data.provider : "r2",
  };
};

type StorableAttachment = string | Record<string, unknown>;

const buildStorableAttachments = async (
  raw: unknown
): Promise<StorableAttachment[] | undefined> => {
  if (!raw || !Array.isArray(raw)) return undefined;
  const out: StorableAttachment[] = [];
  for (const item of raw) {
    if (item instanceof File) {
      const up = await uploadAchievementAttachmentClient(item);
      out.push({
        url: up.url,
        key: up.key,
        name: up.fileName,
        mimeType: up.mimeType,
        size: up.size,
        provider: up.provider,
      });
    } else if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      if (typeof o.url === "string" && o.url.trim()) {
        out.push({ ...o });
      }
    }
  }
  return out.length > 0 ? out : undefined;
};

export const buildAchievementFormSubmitPayload = async (
  data: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  let imageUrl: string | undefined;
  let imagePublicId: string | undefined;

  if (data.image instanceof File) {
    const uploaded = await uploadAchievementImageClient(data.image);
    imageUrl = uploaded.url;
    if (uploaded.publicId) {
      imagePublicId = uploaded.publicId;
    }
  } else if (typeof data.image === "string" && data.image.trim()) {
    imageUrl = data.image.trim();
    if (typeof data.imagePublicId === "string" && data.imagePublicId.trim()) {
      imagePublicId = data.imagePublicId.trim();
    }
  }

  const storableAttachments = await buildStorableAttachments(data.attachments);

  let actualAchievementName: string | undefined = undefined;
  if (data.achievementName && data.achievementName !== "other") {
    actualAchievementName = String(data.achievementName);
  } else if (data.customAchievementName) {
    actualAchievementName = String(data.customAchievementName);
  } else if (data.nameAr || data.nameEn) {
    actualAchievementName = String(data.nameAr || data.nameEn);
  } else if (data.achievementType === "gifted_discovery") {
    actualAchievementName = "exceptional_gifted";
  }

  const payload: Record<string, unknown> = {
    achievementType: data.achievementType,
    achievementCategory: data.achievementCategory || data.achievementType || "competition",
    achievementClassification: data.achievementClassification,
    achievementLevel: data.achievementLevel,
    participationType: data.participationType,
    resultType: data.resultType,
    resultValue: data.resultValue,
    nameAr: data.nameAr || actualAchievementName || "",
    nameEn: data.nameEn || actualAchievementName || "",
    achievementYear: data.achievementYear || new Date().getFullYear(),
    achievementDate: data.achievementDate,
    featured: data.featured || false,
    evidenceRequiredMode: data.evidenceRequiredMode || "provided",
  };

  if (data.inferredField && String(data.inferredField).trim()) {
    payload.inferredField = String(data.inferredField).trim();
  }

  if (actualAchievementName) {
    // Always send achievementName if present (even "other") so server can correctly resolve `finalName`.
    if (data.achievementName) {
      payload.achievementName = data.achievementName;
    }
    if (data.customAchievementName) {
      payload.customAchievementName = data.customAchievementName;
    }
  }

  if (data.medalType) payload.medalType = data.medalType;
  if (data.rank) payload.rank = data.rank;
  if (data.nominationText) payload.nominationText = data.nominationText;
  if (data.specialAwardText) payload.specialAwardText = data.specialAwardText;
  if (data.recognitionText) payload.recognitionText = data.recognitionText;
  if (data.otherResultText) payload.otherResultText = data.otherResultText;

  if (data.participationType === "team" && data.teamRole) {
    payload.teamRole = data.teamRole;
  }

  if (data.achievementType === "program") {
    if (data.programName && data.programName !== "other") {
      payload.programName = data.programName;
    } else if (data.customProgramName) {
      payload.customProgramName = data.customProgramName;
    }
  }

  if (data.achievementType === "competition") {
    if (data.competitionName && data.competitionName !== "other") {
      payload.competitionName = data.competitionName;
    } else if (data.customCompetitionName) {
      payload.customCompetitionName = data.customCompetitionName;
    }
  }

  if (data.achievementType === "exhibition") {
    if (data.exhibitionName && data.exhibitionName !== "other") {
      payload.exhibitionName = data.exhibitionName;
    } else if (data.customExhibitionName) {
      payload.customExhibitionName = data.customExhibitionName;
    }
  }

  if (data.achievementType === "olympiad") {
    if (data.olympiadMeeting) payload.olympiadMeeting = data.olympiadMeeting;
    if (data.olympiadField) payload.olympiadField = data.olympiadField;
  }

  if (data.achievementType === "excellence_program") {
    if (data.excellenceProgramName && data.excellenceProgramName !== "other") {
      payload.excellenceProgramName = data.excellenceProgramName;
    } else if (data.customExcellenceProgramName) {
      payload.customExcellenceProgramName = data.customExcellenceProgramName;
    }
  }

  if (data.achievementType === "qudrat" && data.qudratScore) {
    payload.qudratScore = data.qudratScore;
  }

  if (data.achievementType === "mawhiba_annual") {
    if (data.mawhibaAnnualRank) payload.mawhibaAnnualRank = data.mawhibaAnnualRank;
    if (data.mawhibaAnnualSubject) payload.mawhibaAnnualSubject = data.mawhibaAnnualSubject;
  }

  if (data.achievementType === "gifted_discovery" && data.giftedDiscoveryScore) {
    payload.giftedDiscoveryScore = data.giftedDiscoveryScore;
  }

  if (data.description) payload.description = data.description;
  if (imageUrl) payload.image = imageUrl;
  if (imagePublicId) payload.imagePublicId = imagePublicId;
  if (storableAttachments) payload.attachments = storableAttachments;
  if (data.evidenceUrl) payload.evidenceUrl = data.evidenceUrl;
  if (data.evidenceFileName) payload.evidenceFileName = data.evidenceFileName;

  return payload;
};
