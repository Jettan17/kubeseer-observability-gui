/**
 * Utilities for exporting data (logs, metrics) to local files.
 */

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export log lines as plain text.
 */
export function exportLogsAsText(
  lines: { timestamp: string; container: string; message: string }[]
): string {
  return lines
    .map((l) => `${l.timestamp} [${l.container}] ${l.message}`)
    .join('\n');
}

/**
 * Export log lines as JSON.
 */
export function exportLogsAsJson(
  lines: { timestamp: string; container: string; level?: string; message: string }[]
): string {
  return JSON.stringify(lines, null, 2);
}

/**
 * Export time series data as CSV.
 */
export function exportMetricsAsCsv(
  _seriesName: string,
  points: { timestamp: number; value: number }[]
): string {
  const header = 'timestamp,value';
  const rows = points.map(
    (p) => `${new Date(p.timestamp).toISOString()},${p.value}`
  );
  return [header, ...rows].join('\n');
}
