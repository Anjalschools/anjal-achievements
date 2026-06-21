type ExportRow = Record<string, string | number>;

export const exportTrainingApplicationsTable = async (input: {
  headers: string[];
  rows: ExportRow[];
  filenameBase: string;
  format: "xlsx" | "csv";
}) => {
  const XLSX = await import("xlsx");
  const sheetRows = input.rows.map((row) => {
    const mapped: Record<string, string | number> = {};
    input.headers.forEach((header) => {
      mapped[header] = row[header] ?? "";
    });
    return mapped;
  });
  const worksheet = XLSX.utils.json_to_sheet(sheetRows, { header: input.headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Applications");

  if (input.format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${input.filenameBase}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const arr = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([arr], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${input.filenameBase}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
};
