/**
 * Achievement validation schema
 * Validates achievement data before saving to database
 */

export interface AchievementValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface AchievementFormData {
  title: string;
  description: string;
  achievementType: "rank" | "medal" | "award" | "participation";
  position?: number;
  rank?: "first" | "second" | "third" | "fourth" | "fifth";
  medalType?: "gold" | "silver" | "bronze";
  domain: string;
  competition?: string;
  organization: string;
  date: string; // ISO format YYYY-MM-DD
  level: "school" | "regional" | "national" | "international";
  image?: string; // base64 or URL
  attachments?: string[]; // base64 or URLs
  certificateNumber?: string;
  featured?: boolean;
}

const VALID_ACHIEVEMENT_TYPES = ["rank", "medal", "award", "participation"];
const VALID_DOMAINS = ["STEM", "Science", "Math", "Technology", "Innovation", "Language", "Arts"];
const VALID_LEVELS = ["school", "regional", "national", "international"];
const VALID_MEDAL_TYPES = ["gold", "silver", "bronze"];
const VALID_RANKS = ["first", "second", "third", "fourth", "fifth"];

/**
 * Validate achievement form data
 */
export function validateAchievement(data: Partial<AchievementFormData>): AchievementValidationResult {
  const errors: Record<string, string> = {};

  // Required fields
  if (!data.title || !data.title.trim()) {
    errors.title = "Title is required";
  } else if (data.title.trim().length < 3) {
    errors.title = "Title must be at least 3 characters";
  } else if (data.title.trim().length > 200) {
    errors.title = "Title must be less than 200 characters";
  }

  if (!data.description || !data.description.trim()) {
    errors.description = "Description is required";
  } else if (data.description.trim().length < 10) {
    errors.description = "Description must be at least 10 characters";
  } else if (data.description.trim().length > 2000) {
    errors.description = "Description must be less than 2000 characters";
  }

  if (!data.achievementType) {
    errors.achievementType = "Achievement type is required";
  } else if (!VALID_ACHIEVEMENT_TYPES.includes(data.achievementType)) {
    errors.achievementType = "Invalid achievement type";
  }

  if (!data.domain) {
    errors.domain = "Domain/Category is required";
  } else if (!VALID_DOMAINS.includes(data.domain)) {
    errors.domain = "Invalid domain";
  }

  if (!data.organization || !data.organization.trim()) {
    errors.organization = "Organization is required";
  } else if (data.organization.trim().length > 200) {
    errors.organization = "Organization name must be less than 200 characters";
  }

  if (!data.date) {
    errors.date = "Date is required";
  } else {
    // Validate ISO date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.date)) {
      errors.date = "Date must be in YYYY-MM-DD format";
    } else {
      const dateObj = new Date(data.date);
      if (isNaN(dateObj.getTime())) {
        errors.date = "Invalid date";
      } else if (dateObj > new Date()) {
        errors.date = "Date cannot be in the future";
      }
    }
  }

  if (!data.level) {
    errors.level = "Level is required";
  } else if (!VALID_LEVELS.includes(data.level)) {
    errors.level = "Invalid level";
  }

  // Conditional validation based on achievement type
  if (data.achievementType === "rank") {
    if (data.rank && !VALID_RANKS.includes(data.rank)) {
      errors.rank = "Invalid rank";
    }
    if (data.position !== undefined) {
      if (data.position < 1 || data.position > 10) {
        errors.position = "Position must be between 1 and 10";
      }
    }
  }

  if (data.achievementType === "medal") {
    if (!data.medalType) {
      errors.medalType = "Medal type is required for medal achievements";
    } else if (!VALID_MEDAL_TYPES.includes(data.medalType)) {
      errors.medalType = "Invalid medal type";
    }
  }

  // Optional fields validation
  if (data.certificateNumber && data.certificateNumber.trim().length > 100) {
    errors.certificateNumber = "Certificate number must be less than 100 characters";
  }

  // Image validation (if provided as base64)
  if (data.image) {
    if (data.image.startsWith("data:image/")) {
      // Base64 image
      const base64Data = data.image.split(",")[1];
      if (!base64Data) {
        errors.image = "Invalid image format";
      } else {
        // Check size (max 5MB)
        const sizeInBytes = (base64Data.length * 3) / 4;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        if (sizeInMB > 5) {
          errors.image = "Image size must be less than 5MB";
        }
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Normalize achievement data before saving
 * Ensures only valid values are stored (no Arabic labels)
 */
export function normalizeAchievementData(
  data: Partial<AchievementFormData>
): Partial<AchievementFormData> {
  const normalized: Partial<AchievementFormData> = {
    ...data,
    title: data.title?.trim(),
    description: data.description?.trim(),
    organization: data.organization?.trim(),
    competition: data.competition?.trim(),
    certificateNumber: data.certificateNumber?.trim(),
  };

  // Ensure date is in ISO format
  if (data.date) {
    const dateObj = new Date(data.date);
    if (!isNaN(dateObj.getTime())) {
      normalized.date = dateObj.toISOString().split("T")[0];
    }
  }

  // Remove undefined values
  Object.keys(normalized).forEach((key) => {
    if (normalized[key as keyof AchievementFormData] === undefined) {
      delete normalized[key as keyof AchievementFormData];
    }
  });

  return normalized;
}
