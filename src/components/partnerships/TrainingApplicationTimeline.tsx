"use client";

import { timelineActionLabel } from "@/lib/partnerships/partnerships-application-workflow";

export type TrainingTimelineEvent = {
  at: string | null;
  action: string;
  note?: string;
};

const TrainingApplicationTimeline = ({
  events,
  isAr,
  className = "",
}: {
  events: TrainingTimelineEvent[];
  isAr: boolean;
  className?: string;
}) => {
  if (!events.length) {
    return (
      <p className="text-sm text-text-light" role="status">
        {isAr ? "لا توجد أحداث في الجدول الزمني بعد." : "No timeline events yet."}
      </p>
    );
  }

  return (
    <ol className={`relative space-y-0 border-s-2 border-primary/20 ps-4 ${className}`} aria-label={isAr ? "جدول زمني للطلب" : "Application timeline"}>
      {events.map((event, index) => {
        const label = timelineActionLabel(String(event.action || ""), isAr);
        const isLast = index === events.length - 1;
        return (
          <li key={`${event.action}-${event.at}-${index}`} className="relative pb-5 last:pb-0">
            <span
              className={`absolute -start-[1.3rem] top-1 flex h-3 w-3 rounded-full ring-2 ring-white ${
                isLast ? "bg-primary" : "bg-primary/40"
              }`}
              aria-hidden
            />
            <div className="rounded-lg border border-border/60 bg-white px-3 py-2">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              {event.at ? (
                <time className="mt-0.5 block text-xs text-text-muted" dateTime={event.at}>
                  {new Date(event.at).toLocaleString(isAr ? "ar-SA" : "en-GB")}
                </time>
              ) : null}
              {event.note ? (
                <p className="mt-1 text-xs text-text-light">{event.note}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default TrainingApplicationTimeline;
