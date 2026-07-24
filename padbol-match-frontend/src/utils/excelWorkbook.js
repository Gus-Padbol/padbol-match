import writeExcelFile from 'write-excel-file/browser';

function safeWorksheetName(name, fallback = 'Datos') {
  const cleaned = String(name || fallback)
    .replace(/[\\/*?:[\]]/g, ' ')
    .trim();
  return (cleaned || fallback).slice(0, 31);
}

export function createExcelWorkbook() {
  return { sheets: [] };
}

export function appendJsonWorksheet(workbook, rows, name) {
  const data = Array.isArray(rows) ? rows : [];
  const keys = data.reduce((all, row) => {
    Object.keys(row || {}).forEach((key) => {
      if (!all.includes(key)) all.push(key);
    });
    return all;
  }, []);
  const sheet = {
    sheet: safeWorksheetName(name),
    data: [
      keys.map((key) => ({ value: key, fontWeight: 'bold' })),
      ...data.map((row) => keys.map((key) => row?.[key] ?? null)),
    ],
    columns: keys.map((key) => ({
    width: Math.min(
      42,
      Math.max(
        12,
        String(key).length + 2,
        ...data.map((row) => String(row?.[key] ?? '').length + 2)
      )
    ),
    })),
    stickyRowsCount: keys.length ? 1 : 0,
  };
  workbook.sheets.push(sheet);
  return sheet;
}

export async function downloadExcelWorkbook(workbook, filename) {
  await writeExcelFile(workbook.sheets).toFile(filename);
}
