"use client";

import { useCallback, useState } from "react";
import { Loader2, X } from "lucide-react";

type Props = {
  open: boolean;
  userId: string | null;
  userLabel: string;
  isAr: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export const AdminUserPasswordDialog = ({
  open,
  userId,
  userLabel,
  isAr,
  onClose,
  onSuccess,
}: Props) => {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setPassword("");
    setPasswordConfirm("");
    setError(null);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!userId) return;
    setError(null);
    if (password.length < 8) {
      setError(isAr ? "كلمة المرور 8 أحرف على الأقل" : "Password must be at least 8 characters");
      return;
    }
    if (password !== passwordConfirm) {
      setError(isAr ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, passwordConfirm }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      handleClose();
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }, [userId, password, passwordConfirm, isAr, handleClose, onSuccess]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-pw-title"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 id="admin-pw-title" className="text-lg font-bold text-text">
            {isAr ? "تغيير كلمة المرور" : "Change password"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-text-light hover:bg-gray-100"
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-text-light">{userLabel}</p>
        {error ? (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <label className="mb-3 block text-xs font-semibold text-text-light">
          {isAr ? "كلمة المرور الجديدة" : "New password"}
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="mb-4 block text-xs font-semibold text-text-light">
          {isAr ? "تأكيد كلمة المرور" : "Confirm password"}
          <input
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSubmit();
            }}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-text hover:bg-gray-50"
          >
            {isAr ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {isAr ? "حفظ" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};
