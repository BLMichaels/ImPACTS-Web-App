import type { jsPDF } from 'jspdf';

export const SNAPSHOT_PDF = {
  margin: 20,
  titleY: 28,
  primary: [33, 150, 243] as [number, number, number],
  ink: [33, 37, 41] as [number, number, number],
  muted: [108, 117, 125] as [number, number, number],
  surface: [248, 249, 250] as [number, number, number],
  border: [224, 224, 224] as [number, number, number],
  success: [76, 175, 80] as [number, number, number],
};

export interface SnapshotPdfLayout {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  titleY: number;
}

export function getSnapshotPdfLayout(doc: jsPDF): SnapshotPdfLayout {
  return {
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    margin: SNAPSHOT_PDF.margin,
    titleY: SNAPSHOT_PDF.titleY,
  };
}

export function wrapTextJsPdf(doc: jsPDF, text: string, maxWidth: number, fontSize: number): string[] {
  doc.setFontSize(fontSize);
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const test = current ? `${current} ${word}` : word;
    if (doc.getTextWidth(test) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  });
  if (current) lines.push(current);
  return lines;
}

export function addWrappedTextJsPdf(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight = fontSize * 0.42
): number {
  const lines = wrapTextJsPdf(doc, text, maxWidth, fontSize);
  let currentY = y;
  lines.forEach((line) => {
    doc.text(line, x, currentY);
    currentY += lineHeight;
  });
  return currentY;
}

export function ensurePdfSpace(
  doc: jsPDF,
  layout: SnapshotPdfLayout,
  currentY: number,
  needed: number
): number {
  if (currentY + needed <= layout.pageHeight - layout.margin) return currentY;
  doc.addPage();
  return layout.titleY;
}

export function addPdfSectionHeader(doc: jsPDF, layout: SnapshotPdfLayout, text: string, y: number): number {
  const { margin } = layout;
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SNAPSHOT_PDF.primary);
  doc.text(text, margin, y);
  doc.setDrawColor(...SNAPSHOT_PDF.primary);
  doc.setLineWidth(0.6);
  doc.line(margin, y + 3, margin + 42, y + 3);
  doc.setTextColor(...SNAPSHOT_PDF.ink);
  return y + 18;
}

export function addPdfProgressBar(
  doc: jsPDF,
  layout: SnapshotPdfLayout,
  label: string,
  percentage: number,
  y: number,
  description?: string
): number {
  const { margin, pageWidth } = layout;
  const labelWidth = pageWidth - margin * 2 - 100;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SNAPSHOT_PDF.ink);
  const labelEndY = addWrappedTextJsPdf(doc, label, margin, y, labelWidth, 10);
  const barY = labelEndY + 2;

  doc.setDrawColor(...SNAPSHOT_PDF.border);
  doc.setFillColor(...SNAPSHOT_PDF.surface);
  doc.roundedRect(margin, barY, pageWidth - margin * 2 - 36, 7, 1, 1, 'FD');

  const fillWidth = ((pageWidth - margin * 2 - 36) * Math.min(100, Math.max(0, percentage))) / 100;
  if (fillWidth > 0) {
    doc.setFillColor(...SNAPSHOT_PDF.success);
    doc.roundedRect(margin, barY, fillWidth, 7, 1, 1, 'F');
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SNAPSHOT_PDF.muted);
  doc.text(`${percentage}%`, pageWidth - margin - 28, barY + 5);

  let nextY = barY + 12;
  if (description) {
    doc.setFont('helvetica', 'normal');
    nextY = addWrappedTextJsPdf(doc, description, margin + 2, nextY, pageWidth - margin * 2 - 4, 9) + 4;
  }
  return nextY + 4;
}

export interface CategoryHoursRow {
  label: string;
  count: number;
  hours: number;
}

/** Table layout: wrapped category names with activities + hours in fixed right columns (no overlap). */
export function addPdfCategoryHoursTable(
  doc: jsPDF,
  layout: SnapshotPdfLayout,
  rows: CategoryHoursRow[],
  startY: number
): number {
  const { margin, pageWidth, pageHeight } = layout;
  const metricsWidth = 88;
  const labelWidth = pageWidth - margin * 2 - metricsWidth - 8;
  const lineHeight = 4.4;
  let y = ensurePdfSpace(doc, layout, startY, 24);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SNAPSHOT_PDF.muted);
  doc.text('ACTIVITY CATEGORY', margin, y);
  doc.text('ACTIVITIES', pageWidth - margin - metricsWidth + 4, y);
  doc.text('HOURS', pageWidth - margin - 34, y);
  y += 6;
  doc.setDrawColor(...SNAPSHOT_PDF.border);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  rows.forEach((row, index) => {
    const labelLines = wrapTextJsPdf(doc, row.label, labelWidth, 9.5);
    const rowHeight = Math.max(16, labelLines.length * lineHeight + 8);
    y = ensurePdfSpace(doc, layout, y, rowHeight + 4);

    if (index % 2 === 0) {
      doc.setFillColor(...SNAPSHOT_PDF.surface);
      doc.rect(margin, y - 5, pageWidth - margin * 2, rowHeight, 'F');
    }

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SNAPSHOT_PDF.ink);
    labelLines.forEach((line, lineIndex) => {
      doc.text(line, margin + 3, y + lineIndex * lineHeight);
    });

    doc.setFont('helvetica', 'bold');
    doc.text(String(row.count), pageWidth - margin - metricsWidth + 4, y);
    doc.setFont('helvetica', 'normal');
    const hoursLabel = Number.isInteger(row.hours) ? String(row.hours) : row.hours.toFixed(1);
    doc.text(hoursLabel, pageWidth - margin - 34, y);

    y += rowHeight + 2;
  });

  if (y > pageHeight - layout.margin - 8) {
    return y;
  }
  return y + 6;
}

export interface HorizontalBarDatum {
  label: string;
  value: number;
}

/** Horizontal bar chart for PDF — labels on the left, bars extend right (handles long names). */
export function addPdfHorizontalBarChart(
  doc: jsPDF,
  layout: SnapshotPdfLayout,
  title: string,
  data: HorizontalBarDatum[],
  startY: number,
  valueSuffix = ''
): number {
  if (!data.length) return startY;
  const { margin, pageWidth } = layout;
  const labelColWidth = 92;
  const barAreaWidth = pageWidth - margin * 2 - labelColWidth - 28;
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  let y = ensurePdfSpace(doc, layout, startY, 20);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SNAPSHOT_PDF.ink);
  doc.text(title, margin, y);
  y += 12;

  data.forEach((item, index) => {
    const labelLines = wrapTextJsPdf(doc, item.label, labelColWidth - 4, 8.5);
    const rowHeight = Math.max(14, labelLines.length * 4 + 6);
    y = ensurePdfSpace(doc, layout, y, rowHeight + 4);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SNAPSHOT_PDF.ink);
    labelLines.forEach((line, lineIndex) => {
      doc.text(line, margin, y + lineIndex * 4);
    });

    const barX = margin + labelColWidth;
    const barMaxHeight = 6;
    doc.setFillColor(...SNAPSHOT_PDF.surface);
    doc.roundedRect(barX, y - 4, barAreaWidth, barMaxHeight, 1, 1, 'F');

    const fillWidth = (item.value / maxValue) * barAreaWidth;
    const palette = [
      [33, 150, 243],
      [76, 175, 80],
      [255, 152, 0],
      [156, 39, 176],
      [0, 188, 212],
    ] as [number, number, number][];
    const color = palette[index % palette.length];
    if (fillWidth > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(barX, y - 4, fillWidth, barMaxHeight, 1, 1, 'F');
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SNAPSHOT_PDF.muted);
    doc.text(`${item.value}${valueSuffix}`, barX + barAreaWidth + 4, y);

    y += rowHeight;
  });

  return y + 8;
}

export function addPdfCoverHeader(doc: jsPDF, layout: SnapshotPdfLayout, subtitle: string): void {
  const { pageWidth, titleY } = layout;
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SNAPSHOT_PDF.primary);
  doc.text('Pediatric Readiness', pageWidth / 2, titleY, { align: 'center' });
  doc.text('Snapshot Report', pageWidth / 2, titleY + 12, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SNAPSHOT_PDF.muted);
  doc.text(subtitle, pageWidth / 2, titleY + 26, { align: 'center' });
  doc.text(`Generated ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}`, pageWidth / 2, titleY + 34, {
    align: 'center',
  });
}
