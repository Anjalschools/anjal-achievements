import type { AlumniReportRow } from "@/lib/alumni/alumni-report-types";

type Cell = string | number | null | undefined;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/** Arabic column titles aligned with {@link alumniOverviewRowToExport}. */
export const ALUMNI_OVERVIEW_EXPORT_HEADERS_AR = [
  "الاسم",
  "البريد",
  "اسم المستخدم",
  "الجوال",
  "الجنس",
  "سنة التخرج",
  "القسم",
  "المسار",
  "حالة التفعيل",
  "الجامعة",
  "دولة الدراسة",
  "الدرجة",
  "التخصص",
  "الوظيفة",
  "الشركة",
  "القطاع",
  "المهارات",
  "الاهتمامات",
  "قصص (كل)",
  "قصص منشورة",
  "فرص",
  "ذكريات (إجمالي)",
  "ذكريات معتمدة",
  "يعرض إرشادًا",
  "حالات إرشاد",
  "السمعة",
  "الثقة",
  "شارات السمعة",
  "مستويات السمعة",
  "قوة الشبكة",
  "توثيق (نقاط)",
  "إرشاد (نقاط)",
  "مجتمع (نقاط)",
  "مسار مهني (نقاط)",
  "محتوى (نقاط)",
  "فعاليات (نقاط)",
  "موثّق",
  "مستوى التوثيق",
  "مصدر التوثيق",
  "آخر طلب توثيق",
  "آخر دخول",
  "آخر تحديث",
] as const;

export const alumniOverviewRowToExport = (r: AlumniReportRow): Record<string, Cell> => ({
  الاسم: r.fullName,
  البريد: r.email,
  "اسم المستخدم": r.username,
  الجوال: r.phone,
  الجنس: r.gender,
  "سنة التخرج": r.graduationYear,
  القسم: r.grade,
  المسار: r.section,
  "حالة التفعيل": r.activationStatus,
  الجامعة: r.universityName,
  "دولة الدراسة": r.studyCountry,
  الدرجة: r.degree,
  التخصص: r.major,
  الوظيفة: r.jobTitle,
  الشركة: r.company,
  القطاع: r.industry,
  المهارات: r.skills,
  الاهتمامات: r.interests,
  "قصص (كل)": r.storyCount,
  "قصص منشورة": r.storyPublishedCount,
  فرص: r.opportunityCount,
  "ذكريات (إجمالي)": r.memoryTotalCount,
  "ذكريات معتمدة": r.memoryApprovedCount,
  "يعرض إرشادًا": r.offersMentoring,
  "حالات إرشاد": r.mentorCases,
  السمعة: r.reputationScore,
  الثقة: r.trustScore,
  "شارات السمعة": r.repBadges,
  "مستويات السمعة": r.repTiers,
  "قوة الشبكة": r.networkStrength,
  "توثيق (نقاط)": r.verificationSub,
  "إرشاد (نقاط)": r.mentorshipSub,
  "مجتمع (نقاط)": r.communitySub,
  "مسار مهني (نقاط)": r.careerSub,
  "محتوى (نقاط)": r.contentSub,
  "فعاليات (نقاط)": r.eventSub,
  موثّق: r.isVerifiedAlumni,
  "مستوى التوثيق": r.verificationTier,
  "مصدر التوثيق": r.verificationSource,
  "آخر طلب توثيق": r.verificationTicketStatus,
  "آخر دخول": r.lastLoginAt,
  "آخر تحديث": r.updatedAt,
});

export const exportAlumniOverviewExcel = async (
  rows: AlumniReportRow[],
  title: string,
  filenameBase: string
) => {
  const XLSX = await import("xlsx");
  const headers = [...ALUMNI_OVERVIEW_EXPORT_HEADERS_AR] as string[];
  const now = new Date().toLocaleString("ar-SA");
  const aoa: string[][] = [];
  aoa.push(["إدارة مدارس الأنجال الأهلية — مجتمع خريجي الأنجال"]);
  aoa.push([title]);
  aoa.push([`تاريخ التصدير: ${now}`]);
  aoa.push([]);
  aoa.push(headers);
  for (const row of rows) {
    const flat = alumniOverviewRowToExport(row);
    aoa.push(headers.map((h) => String(flat[h as keyof typeof flat] ?? "")));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const maxWch = 44;
  ws["!cols"] = headers.map((h) => ({
    wch: Math.min(maxWch, Math.max(8, String(h).length + 2)),
  }));
  const headerRowIndex0 = 4;
  ws["!freeze"] = {
    xSplit: 0,
    ySplit: headerRowIndex0 + 1,
    topLeftCell: XLSX.utils.encode_cell({ c: 0, r: headerRowIndex0 + 1 }),
    activePane: "bottomLeft",
    state: "frozen",
  };
  (ws as { "!sheetViews"?: unknown[] })["!sheetViews"] = [{ rightToLeft: true }];
  if (aoa.length > headerRowIndex0 + 1) {
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { c: 0, r: headerRowIndex0 },
        e: { c: headers.length - 1, r: aoa.length - 1 },
      }),
    };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "alumni-report");
  const arr = XLSX.write(wb, { bookType: "xlsx", type: "array", bookSST: false });
  downloadBlob(
    new Blob([arr], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${filenameBase}.xlsx`
  );
};

export const exportAlumniOverviewPdfPrint = async (
  rows: AlumniReportRow[],
  title: string,
  headerImagePath = "/report-header.png"
) => {
  const now = new Date().toLocaleString("ar-SA");
  const headers = [...ALUMNI_OVERVIEW_EXPORT_HEADERS_AR];
  const safeTitle = escapeHtml(title);
  const tableHead = headers.map((h) => `<th>${escapeHtml(String(h))}</th>`).join("");
  const tableBody = rows
    .map((r) => {
      const flat = alumniOverviewRowToExport(r);
      return `<tr>${headers
        .map((h) => `<td>${escapeHtml(String(flat[h] ?? ""))}</td>`)
        .join("")}</tr>`;
    })
    .join("");

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm 12mm; }
    body { font-family: Tahoma, Arial, sans-serif; margin: 0; color: #0f172a; direction: rtl; }
    .header img { max-width: 100%; height: auto; margin-bottom: 10px; }
    h1 { font-size: 18px; margin: 0 0 6px 0; }
    .meta { font-size: 11px; color: #475569; margin-bottom: 10px; }
    .wrap { margin: 12px 16px 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; table-layout: fixed; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 5px; text-align: right; vertical-align: top;
      word-wrap: break-word; overflow-wrap: anywhere; white-space: normal; }
    th { background: #e2e8f0; font-weight: 700; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .footer { font-size: 10px; color: #64748b; margin-top: 8px; text-align: center; }
    @media print {
      body { margin: 0; }
      .wrap { margin: 0; }
    }
  </style>
  </head><body>
    <div class="wrap">
    <div class="header"><img src="${headerImagePath}" alt="" /></div>
    <h1>${safeTitle}</h1>
    <div class="meta">تاريخ التصدير: ${escapeHtml(now)} — تقرير خريجي الأنجال</div>
    <table>
      <thead><tr>${tableHead}</tr></thead>
      <tbody>${tableBody}</tbody>
      <tfoot><tr><td colspan="${headers.length}" class="footer">مدارس الأنجال الأهلية — وثيقة رسمية — يُراعى السرية عند المشاركة</td></tr></tfoot>
    </table>
    </div>
  </body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.left = "-10000px";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!doc || !win) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const schedulePrint = () => {
    setTimeout(() => {
      win.print();
    }, 280);
  };
  const img = doc.querySelector("img");
  if (!img) {
    schedulePrint();
  } else if (img.complete) {
    schedulePrint();
  } else {
    img.onload = () => schedulePrint();
    img.onerror = () => schedulePrint();
  }

  setTimeout(() => {
    iframe.remove();
  }, 6000);
};
