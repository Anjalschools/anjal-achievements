/**
 * Builds the JSON body for POST/PUT /api/achievements from the same shape
 * `AchievementForm` passes to `onSubmit`. Used by student and admin manual flows.
 */
export const buildAchievementFormSubmitPayload = async (
  data: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  let imageBase64: string | undefined = undefined;
  if (data.image instanceof File) {
    imageBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to convert image to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(data.image as File);
    });
  } else if (typeof data.image === "string") {
    imageBase64 = data.image;
  }

  const attachmentsBase64: string[] = [];
  if (data.attachments && Array.isArray(data.attachments)) {
    for (const file of data.attachments) {
      if (file instanceof File) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Failed to convert attachment to base64"));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        attachmentsBase64.push(base64);
      } else if (typeof file === "string") {
        attachmentsBase64.push(file);
      }
    }
  }

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
  if (imageBase64) payload.image = imageBase64;
  if (attachmentsBase64.length > 0) payload.attachments = attachmentsBase64;
  if (data.evidenceUrl) payload.evidenceUrl = data.evidenceUrl;
  if (data.evidenceFileName) payload.evidenceFileName = data.evidenceFileName;

  return payload;
};
