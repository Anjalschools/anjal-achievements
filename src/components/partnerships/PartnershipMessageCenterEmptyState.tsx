"use client";

import { MessageSquare } from "lucide-react";

type PartnershipMessageCenterEmptyStateProps = {
  isAr: boolean;
};

const PartnershipMessageCenterEmptyState = ({ isAr }: PartnershipMessageCenterEmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
      <MessageSquare className="h-7 w-7" aria-hidden />
    </div>
    <p className="text-base font-bold text-slate-700">
      {isAr ? "اختر محادثة لعرض الرسائل" : "Select a conversation to view messages"}
    </p>
    <p className="max-w-sm text-sm text-slate-500">
      {isAr
        ? "اختر محادثة من القائمة لعرض سجل الرسائل والرد عليها."
        : "Pick a thread from the list to read the message history and reply."}
    </p>
  </div>
);

export default PartnershipMessageCenterEmptyState;
