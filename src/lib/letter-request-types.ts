/** Client-safe letter request enums (avoid importing Mongoose models in client components). */
export type LetterRequestLanguage = "ar" | "en";
export type LetterRequestType = "testimonial" | "recommendation";
export type LetterRequestedAuthorRole = "teacher" | "supervisor" | "school_administration";
export type LetterRequestStatus = "pending" | "in_review" | "approved" | "rejected" | "needs_revision";
