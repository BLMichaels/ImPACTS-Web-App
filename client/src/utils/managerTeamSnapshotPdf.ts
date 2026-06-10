import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import type { ManagerTeamDashboardData } from '../hooks/useManagerTeamDashboard';
import {
  addPdfCoverHeader,
  addPdfSectionHeader,
  ensurePdfSpace,
  getSnapshotPdfLayout,
  SNAPSHOT_PDF,
} from './snapshotPdfExport';

export function exportManagerTeamSnapshotPdf(
  data: ManagerTeamDashboardData,
  managerName: string
): void {
  const doc = new jsPDF();
  const layout = getSnapshotPdfLayout(doc);

  addPdfCoverHeader(doc, layout, `ImPACTS Manager Team Report — ${managerName}`);

  let y = layout.titleY + 48;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SNAPSHOT_PDF.ink);

  const summaryLines = [
    `${data.mentors.length} mentors • ${data.totalSites} sites • ${data.totalPeccs} PECCs`,
    `Average PECC checklist progress: ${data.avgPeccProgress}%`,
    `Team hours this month: ${data.teamHoursThisMonth.toFixed(1)}h (${data.teamActivitiesThisMonth} activities)`,
    `Team lifetime hours: ${data.teamTotalHours.toFixed(1)}h`,
  ];
  summaryLines.forEach((line) => {
    doc.text(line, layout.margin, y);
    y += 6;
  });

  if (data.managerOwn.hasAssignments) {
    y += 4;
    y = ensurePdfSpace(doc, layout, y, 24);
    y = addPdfSectionHeader(doc, layout, 'My mentoring', y);
    doc.setFontSize(10);
    doc.text(`Sites: ${data.managerOwn.hospitalNames.join(', ') || 'None'}`, layout.margin, y);
    y += 6;
    doc.text(
      `${data.managerOwn.totalActivities} activities • ${data.managerOwn.hoursTotal.toFixed(1)}h total • ${data.managerOwn.hoursThisMonth.toFixed(1)}h this month`,
      layout.margin,
      y
    );
    y += 10;
  }

  y = ensurePdfSpace(doc, layout, y, 30);
  y = addPdfSectionHeader(doc, layout, 'Mentors & sites', y);

  if (data.mentors.length === 0) {
    doc.setFontSize(10);
    doc.text('No mentors under your management yet.', layout.margin, y);
  } else {
    data.mentors.forEach((mentor) => {
      y = ensurePdfSpace(doc, layout, y, 28);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...SNAPSHOT_PDF.primary);
      doc.text(`${mentor.firstName} ${mentor.lastName}`, layout.margin, y);
      y += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...SNAPSHOT_PDF.muted);
      doc.text(mentor.email, layout.margin, y);
      y += 5;
      doc.setTextColor(...SNAPSHOT_PDF.ink);
      doc.text(
        `${mentor.assignedHospitals.length} sites • ${mentor.activitiesThisMonth} activities this month • ${mentor.hoursThisMonth.toFixed(1)}h this month`,
        layout.margin,
        y
      );
      y += 5;

      mentor.assignedHospitals.slice(0, 8).forEach((h) => {
        y = ensurePdfSpace(doc, layout, y, 6);
        doc.text(`  • ${h.name} (${h.peccCount} PECC${h.peccCount !== 1 ? 's' : ''})`, layout.margin, y);
        y += 5;
      });
      if (mentor.assignedHospitals.length > 8) {
        doc.text(`  … and ${mentor.assignedHospitals.length - 8} more sites`, layout.margin, y);
        y += 5;
      }

      if (mentor.lastActivity) {
        doc.setTextColor(...SNAPSHOT_PDF.muted);
        doc.text(
          `Last activity: ${format(new Date(mentor.lastActivity), 'MMM d, yyyy')}`,
          layout.margin,
          y
        );
        y += 5;
      }
      y += 4;
    });
  }

  const stamp = format(new Date(), 'yyyy-MM-dd');
  doc.save(`manager-team-snapshot-${stamp}.pdf`);
}
