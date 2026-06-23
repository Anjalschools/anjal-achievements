"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import {
  isReviewNoteSufficient,
  REVIEW_NOTE_MIN_LENGTH,
  validateSupervisorReviewNote,
  type SupervisorReviewAction,
} from "@/lib/partnerships/final-report-review-ux-constants";

export type FinalReportReviewNoteFieldHandle = {
  focus: () => void;
  scrollIntoView: () => void;
};

type FinalReportReviewNoteFieldProps = {
  value: string;
  onChange: (value: string) => void;
  locale: "ar" | "en";
  validationError: string | null;
  shake: boolean;
  id?: string;
};

const FinalReportReviewNoteField = forwardRef<
  FinalReportReviewNoteFieldHandle,
  FinalReportReviewNoteFieldProps
>(({ value, onChange, locale, validationError, shake, id = "final-report-review-note" }, ref) => {
  const isAr = locale === "ar";
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    scrollIntoView: () =>
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
  }));

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-bold text-slate-700">
        {isAr ? "ملاحظة المراجعة" : "Review note"}
      </label>
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        placeholder={
          isAr
            ? `اكتب المطلوب تعديله أو سبب الرفض (${REVIEW_NOTE_MIN_LENGTH} أحرف على الأقل)`
            : `Describe required changes or rejection reason (min ${REVIEW_NOTE_MIN_LENGTH} characters)`
        }
        aria-invalid={validationError ? "true" : "false"}
        aria-describedby={validationError ? `${id}-error` : undefined}
        className={`w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          validationError
            ? "border-red-400 bg-red-50/40"
            : "border-slate-200 bg-white"
        } ${shake ? "animate-shake" : ""}`}
      />
      {validationError ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-2 text-xs font-semibold text-red-700"
        >
          {validationError}
        </p>
      ) : null}
    </div>
  );
});

FinalReportReviewNoteField.displayName = "FinalReportReviewNoteField";

export default FinalReportReviewNoteField;

export const runReviewNoteClientValidation = (
  note: string,
  action: SupervisorReviewAction,
  locale: "ar" | "en"
) => validateSupervisorReviewNote(note, action, locale);

export { isReviewNoteSufficient };
