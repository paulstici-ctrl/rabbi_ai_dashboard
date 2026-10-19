// Client-side export helpers. CSV cells that could be interpreted as spreadsheet formulas are neutralised.
export const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows, columns) => [columns.map((c) => csvCell(c.label)).join(','), ...rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(','))].join('\n') + '\n';
export function download(name, mime, text, doc = globalThis.document) {
  const url = URL.createObjectURL(new Blob([text], { type: mime })), a = doc.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; doc.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
