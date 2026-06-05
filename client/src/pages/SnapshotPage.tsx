import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  LinearProgress,
  Button,
  Chip,
  Alert,
  Container,
  Paper,
  Snackbar,
  Stack,
  Divider
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { supabase } from '../supabase';
import {
  getUserData,
  setUserData,
  migrateFromLocalStorage,
  resolveHospitalUuid,
  writeContinuityData,
  getContinuityData,
} from '../utils/userData';
import { usePermission, usePrsSectionVisible } from '../hooks/usePermissions';
import { PERMISSIONS } from '../types/database';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WorkIcon from '@mui/icons-material/Work';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RemoveIcon from '@mui/icons-material/Remove';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import {
  type PRSQuestion,
  calculateDomainScores,
  calculateCurrentPRSScorePercent
} from '../utils/snapshotPrsScoring';
import {
  gapPlanHasStatus,
  isGapPlanCompleted,
  isMilestoneCompleted,
  isSimulationGapCompleted
} from '../utils/snapshotGapStatus';
import { parseActivityDate } from '../utils/snapshotActivityDate';
import { isSimulationActivity } from '../utils/mentorActivityCategories';
import {
  computeChecklistMetrics,
  computeWorkHours,
  formatActivityDateLabel,
  mergeReadinessScoreSources,
  type ChecklistDbProgress,
} from '../utils/snapshotMetrics';
import { PeccReadinessTrendChart } from '../components/pecc/PeccReadinessTrendChart';
import { SnapshotBarChart } from '../components/pecc/SnapshotBarChart';
import { SnapshotHorizontalBarChart } from '../components/pecc/SnapshotHorizontalBarChart';
import {
  addPdfCategoryHoursTable,
  addPdfCoverHeader,
  addPdfHorizontalBarChart,
  addPdfSectionHeader,
  getSnapshotPdfLayout,
  type CategoryHoursRow,
} from '../utils/snapshotPdfExport';
import { useNavigate } from 'react-router-dom';

const metricCardSx = {
  height: '100%',
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  boxShadow: 'none',
  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
  '&:hover': {
    boxShadow: '0 4px 24px rgba(15, 23, 42, 0.08)',
    borderColor: 'action.hover'
  }
} as const;

const SnapshotPage = () => {
  useAuth();
  const navigate = useNavigate();
  const { effectiveUserId, siteId } = useUserProfile();
  
  const [activities, setActivities] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [gapPlans, setGapPlans] = useState<any[]>([]);
  const [simulationGaps, setSimulationGaps] = useState<any[]>([]);
  const [readinessScores, setReadinessScores] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [pdfSnackbar, setPdfSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });
  const [prsSectionVisible] = usePrsSectionVisible();
  const canViewPrs = usePermission(PERMISSIONS.VIEW_PRS);
  const showPrsSection = prsSectionVisible && canViewPrs;
  const [snapshotReadinessChartsVisible, setSnapshotReadinessChartsVisible] = useState<boolean | null>(null);
  const [prsQuestions, setPrsQuestions] = useState<PRSQuestion[] | null>(null);
  const [effectiveHospitalId, setEffectiveHospitalId] = useState<string | null>(null);
  const [activitySubmitterById, setActivitySubmitterById] = useState<Record<string, string>>({});
  const [checklistDbProgress, setChecklistDbProgress] = useState<ChecklistDbProgress | null>(null);
  const userId = effectiveUserId;

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!siteId) {
        if (mounted) setEffectiveHospitalId(null);
        return;
      }
      const resolved = await resolveHospitalUuid(siteId);
      if (mounted) setEffectiveHospitalId(resolved);
    })();
    return () => {
      mounted = false;
    };
  }, [siteId]);

  useEffect(() => {
    if (!userId) return;
    getUserData<boolean>(userId, 'snapshot_readiness_charts_visible').then((charts) =>
      setSnapshotReadinessChartsVisible(charts !== false)
    );
  }, [userId]);

  const setReadinessChartsVisiblePref = async (visible: boolean) => {
    if (!userId) return;
    await setUserData(userId, 'snapshot_readiness_charts_visible', visible);
    setSnapshotReadinessChartsVisible(visible);
  };

  const domainScores = useMemo(() => {
    try {
      return calculateDomainScores(prsQuestions);
    } catch (error) {
      console.error('Error calculating domain scores:', error);
      return null;
    }
  }, [prsQuestions]);

  const currentPRSScore = useMemo(() => calculateCurrentPRSScorePercent(prsQuestions), [prsQuestions]);
  const checklistMetrics = useMemo(
    () => computeChecklistMetrics(milestones, checklistDbProgress),
    [milestones, checklistDbProgress]
  );
  const workHours = useMemo(() => computeWorkHours(activities), [activities]);
  const simulationActivities = useMemo(
    () => activities.filter((a) => isSimulationActivity(a)),
    [activities]
  );
  const simulationTypeData = useMemo(() => {
    const types = Array.from(
      new Set(simulationActivities.map((a) => String(a.simulation || 'Other')))
    );
    return types.map((simType) => ({
      label: simType === 'Other' ? 'Other' : simType,
      value: simulationActivities.filter(
        (a) =>
          (a.simulation || 'Other') === simType ||
          (!a.simulation && simType === 'Other')
      ).length,
    }));
  }, [simulationActivities]);
  const domainBarData = useMemo(() => {
    if (!domainScores) return [];
    return Object.entries(domainScores).map(([domain, data]) => ({
      label: domain,
      value: data.percentage,
      sublabel: `${data.earned.toFixed(1)}/${data.total} pts`,
    }));
  }, [domainScores]);

  const simulationParticipantData = useMemo(() => {
    const types = Array.from(
      new Set(simulationActivities.map((a) => String(a.simulation || 'Other')))
    );
    return types.map((simType) => {
      const rows = simulationActivities.filter(
        (a) =>
          (a.simulation || 'Other') === simType ||
          (!a.simulation && simType === 'Other')
      );
      const total = rows.reduce((sum, a) => sum + (Number(a.participants) || 0), 0);
      const avg = rows.length > 0 ? Math.round(total / rows.length) : 0;
      return {
        label: simType === 'Other' ? 'Other' : simType,
        value: total,
        sublabel: `avg ${avg}`,
      };
    });
  }, [simulationActivities]);
  const activityTime = (dateValue: unknown): number => {
    const parsed = parseActivityDate(dateValue);
    return parsed ? parsed.getTime() : 0;
  };
  const getActivityCategories = (activity: any): string[] => {
    if (Array.isArray(activity?.categories)) {
      const next = (activity.categories as unknown[])
        .map((v: unknown) => String(v || '').trim())
        .filter((v: string) => Boolean(v)) as string[];
      if (next.length > 0) return [...new Set(next)];
    }
    const single = String(activity?.category || '').trim();
    return single ? [single] : [];
  };
  const hasActivityCategory = (activity: any, category: string): boolean => getActivityCategories(activity).includes(category);
  const displayActivityCategories = (activity: any): string =>
    getActivityCategories(activity).join(', ') || 'Uncategorized';
  const activityCategoryStats = useMemo(() => {
    const stats = new Map<string, { count: number; hours: number }>();
    activities.forEach((activity) => {
      const categories = getActivityCategories(activity);
      const cats = categories.length > 0 ? categories : ['Uncategorized'];
      cats.forEach((category) => {
        const current = stats.get(category) || { count: 0, hours: 0 };
        current.count += 1;
        current.hours += Number(activity.hours) || 0;
        stats.set(category, current);
      });
    });
    return [...stats.entries()]
      .map(([label, value]) => ({ label, count: value.count, hours: value.hours }))
      .sort((a, b) => b.hours - a.hours || b.count - a.count);
  }, [activities]);

  // Load all data for snapshot. When PRS section is hidden, do not load readiness scores or PRS questions.
  useEffect(() => {
    const loadData = async () => {
      if (!userId) return;
      try {
        setIsLoading(true);
        setHasError(false);
        let [activitiesVal, milestonesVal, gapPlansVal, simulationGapsVal, scoresVal, questionsVal, prsScoresVal] =
          await Promise.all([
          getContinuityData<any[]>(effectiveHospitalId, userId, 'activities'),
          getContinuityData<any[]>(effectiveHospitalId, userId, 'milestones'),
          getContinuityData<any[]>(effectiveHospitalId, userId, 'gapPlans'),
          getContinuityData<any[]>(effectiveHospitalId, userId, 'simulation_gaps'),
          showPrsSection ? getContinuityData<any[]>(effectiveHospitalId, userId, 'readinessScores') : Promise.resolve(null),
          showPrsSection ? getContinuityData<any[]>(effectiveHospitalId, userId, 'prsQuestions') : Promise.resolve(null),
          showPrsSection ? getContinuityData<any[]>(effectiveHospitalId, userId, 'prsReadinessScores') : Promise.resolve(null),
        ]);

        if (effectiveHospitalId) {
          const { data: checklistRows } = await supabase
            .from('site_checklist_progress')
            .select('completed')
            .eq('hospital_id', effectiveHospitalId);
          const rows = checklistRows || [];
          setChecklistDbProgress({
            total: rows.length,
            completed: rows.filter((r: { completed: boolean }) => r.completed).length,
          });
        } else {
          setChecklistDbProgress(null);
        }

        if (activitiesVal != null && Array.isArray(activitiesVal)) setActivities(activitiesVal);
        else if (!effectiveHospitalId) await migrateFromLocalStorage(userId, 'activities', `activities_${userId}`, (v) => setActivities(Array.isArray(v) ? v : []));

        if (milestonesVal != null && Array.isArray(milestonesVal)) setMilestones(milestonesVal);
        else if (!effectiveHospitalId) await migrateFromLocalStorage(userId, 'milestones', `milestones_${userId}`, (v) => setMilestones(Array.isArray(v) ? v : []));

        // Load gap plans (try both user-specific and generic keys)
        if (gapPlansVal != null && Array.isArray(gapPlansVal)) setGapPlans(gapPlansVal);
        else if (!effectiveHospitalId) {
          await migrateFromLocalStorage(userId, 'gapPlans', `gapPlans_${userId}`, (v) => setGapPlans(Array.isArray(v) ? v : []));
          try {
            const prsGap = localStorage.getItem('prsGapPlans');
            if (prsGap) {
              const p = JSON.parse(prsGap);
              if (Array.isArray(p)) {
                await writeContinuityData(effectiveHospitalId, userId, 'gapPlans', p);
                setGapPlans(p);
                localStorage.removeItem('prsGapPlans');
              }
            }
          } catch {}
        }

        if (simulationGapsVal != null && Array.isArray(simulationGapsVal)) setSimulationGaps(simulationGapsVal);
        else if (!effectiveHospitalId) await migrateFromLocalStorage(userId, 'simulation_gaps', `simulation_gaps_${userId}`, (v) => setSimulationGaps(Array.isArray(v) ? v : []));

        if (!showPrsSection) {
          setReadinessScores([]);
          setPrsQuestions(null);
        } else {
          const mergedScores = mergeReadinessScoreSources(scoresVal, prsScoresVal);
          if (mergedScores.length > 0) {
            setReadinessScores(mergedScores);
          } else if (!effectiveHospitalId) {
            await migrateFromLocalStorage(userId, 'readinessScores', `readinessScores_${userId}`, (v) =>
              setReadinessScores(mergeReadinessScoreSources(Array.isArray(v) ? v : [], null))
            );
            await migrateFromLocalStorage(userId, 'prsReadinessScores', 'prsReadinessScores', (v) =>
              setReadinessScores(mergeReadinessScoreSources(null, Array.isArray(v) ? v : []))
            );
          } else {
            setReadinessScores([]);
          }
          if (questionsVal != null && Array.isArray(questionsVal)) setPrsQuestions(questionsVal);
          else if (!effectiveHospitalId) await migrateFromLocalStorage(userId, 'prsQuestions', 'prsQuestions', (v) => setPrsQuestions(Array.isArray(v) ? v : null));
        }
      } catch (err) {
        console.error('Error loading snapshot data:', err);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userId, showPrsSection, retryCount, effectiveHospitalId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const submitterIds = [...new Set(
        activities.map((a) => String(a?.submitted_by || '').trim()).filter(Boolean)
      )];
      if (!submitterIds.length) {
        if (!cancelled) setActivitySubmitterById({});
        return;
      }
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', submitterIds);
      if (cancelled || error) return;
      const next: Record<string, string> = {};
      ((data || []) as Array<{ id: string; first_name?: string | null; last_name?: string | null; email?: string | null }>).forEach((u) => {
        const label = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || String(u.email || u.id);
        next[u.id] = label;
      });
      if (!cancelled) setActivitySubmitterById(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [activities]);

  const exportToComprehensivePDF = () => {
    try {
      // Create a comprehensive PDF that captures ALL visual elements from the Snapshot page
      const createComprehensiveReport = () => {
        const doc = new jsPDF();
        
        // Set up styling
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const titleY = 30;
        const sectionY = 50;
        // Helper function to wrap text to fit within page width
        const wrapText = (text: string, maxWidth: number, fontSize: number) => {
          doc.setFontSize(fontSize);
          const words = text.split(' ');
          const lines: string[] = [];
          let currentLine = '';
          
          words.forEach(word => {
            const testLine = currentLine + word + ' ';
            const testWidth = doc.getTextWidth(testLine);
            
            if (testWidth > maxWidth && currentLine !== '') {
              lines.push(currentLine.trim());
              currentLine = word + ' ';
            } else {
              currentLine = testLine;
            }
          });
          
          if (currentLine.trim()) {
            lines.push(currentLine.trim());
          }
          
          return lines;
        };
        
        // Helper function to add wrapped text
        const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number) => {
          const lines = wrapText(text, maxWidth, fontSize);
          let currentY = y;
          
          lines.forEach(line => {
            doc.text(line, x, currentY);
            currentY += fontSize * 0.4; // Adjust line spacing
          });
          
          return currentY;
        };
        
        // Helper function to add section headers
        const addSectionHeader = (text: string, y: number) => {
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(33, 150, 243); // Blue color
          doc.text(text, margin, y);
          doc.setTextColor(0, 0, 0); // Reset to black
          return y + 20;
        };
        
        // Helper function to add metric boxes (like the KPI cards)
        const addMetricBox = (label: string, value: string, description: string, x: number, y: number, width: number) => {
          // Draw box with rounded corners
          doc.setDrawColor(224, 224, 224);
          doc.setFillColor(248, 249, 250);
          doc.roundedRect(x, y, width, 40, 3, 3, 'FD');
          
          // Add value (large, bold)
          doc.setFontSize(18);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(33, 37, 41);
          doc.text(value, x + 5, y + 12);
          
          // Add label
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(33, 37, 41);
          doc.text(label, x + 5, y + 22);
          
          // Add wrapped description
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(108, 117, 125);
          addWrappedText(description, x + 5, y + 30, width - 10, 9);
          
          return y + 40;
        };
        
        // Helper function to add progress bars (like the progress indicators)
        const addProgressBar = (label: string, percentage: number, y: number, description?: string) => {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(33, 37, 41);
          doc.text(label, margin, y);
          
          // Progress bar background
          doc.setDrawColor(224, 224, 224);
          doc.setFillColor(248, 249, 250);
          doc.rect(margin + 80, y - 5, 80, 8, 'FD');
          
          // Progress bar fill
          const fillWidth = (percentage / 100) * 80;
          if (percentage > 0) {
            doc.setFillColor(76, 175, 80); // Green
            doc.rect(margin + 80, y - 5, fillWidth, 8, 'F');
          }
          
          // Percentage text
          doc.setFontSize(10);
          doc.setTextColor(108, 117, 125);
          doc.text(`${percentage}%`, margin + 165, y + 2);
          
          // Add wrapped description if provided
          if (description) {
            doc.setFontSize(9);
            doc.setTextColor(108, 117, 125);
            const descY = addWrappedText(description, margin + 10, y + 8, pageWidth - margin * 2 - 10, 9);
            return descY + 5;
          }
          
          return y + 20;
        };
        
        // Helper function to add chart-like visualizations
        const addChartSection = (title: string, data: Array<{label: string, value: number, color: string}>, y: number) => {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(33, 37, 41);
          doc.text(title, margin, y);
          y += 15;
          
          // Create a simple bar chart representation that fits within page width
          const chartWidth = Math.min(50, (pageWidth - margin * 2 - (data.length - 1) * 10) / data.length);
          const chartHeight = 8;
          const maxValue = Math.max(...data.map(d => d.value));
          
          data.forEach((item, index) => {
            const barHeight = (item.value / maxValue) * chartHeight;
            const xPos = margin + (index * (chartWidth + 10));
            
            // Ensure chart doesn't go beyond page width
            if (xPos + chartWidth <= pageWidth - margin) {
              // Draw bar
              doc.setFillColor(parseInt(item.color.slice(1, 3), 16), parseInt(item.color.slice(3, 5), 16), parseInt(item.color.slice(5, 7), 16));
              doc.rect(xPos, y, chartWidth, barHeight, 'F');
              
              // Draw label (wrapped if needed)
              const labelLines = wrapText(item.label, chartWidth, 9);
              labelLines.forEach((line, lineIndex) => {
                doc.setFontSize(9);
                doc.setTextColor(33, 37, 41);
                doc.text(line, xPos, y + barHeight + 5 + (lineIndex * 4));
              });
              
              // Draw value
              doc.setFontSize(8);
              doc.setTextColor(108, 117, 125);
              doc.text(item.value.toString(), xPos, y + barHeight + 5 + (labelLines.length * 4) + 5);
            }
          });
          
          return y + 25;
        };
        
        const pdfLayout = getSnapshotPdfLayout(doc);

        // Page 1: Executive Summary & Key Performance Indicators
        addPdfCoverHeader(doc, pdfLayout, 'Comprehensive site performance for leadership review');
        
        // Key Performance Indicators Section (like the KPI cards on the page)
        let currentY = addSectionHeader('Key Performance Indicators (KPIs) - Most Critical Metrics', sectionY + 40);
        
        // Calculate metrics exactly like the page does (no PRS data when section hidden)
        const currentScore = showPrsSection && readinessScores.length > 0 ? readinessScores[readinessScores.length - 1]?.score || 0 : 0;
        const completionRate = checklistMetrics.overallPct;
        const completedItems = checklistMetrics.completedTasks;
        const totalItems = checklistMetrics.totalTasks;
        const completedGapPlans = gapPlans.filter(isGapPlanCompleted).length;
        const totalGapPlans = gapPlans.length;
        const gapCompletionRate = totalGapPlans > 0 ? Math.round((completedGapPlans / totalGapPlans) * 100) : 0;
        const completedSimGaps = simulationGaps.filter(isSimulationGapCompleted).length;
        const totalSimGaps = simulationGaps.length;
        const simGapCompletionRate = totalSimGaps > 0 ? Math.round((completedSimGaps / totalSimGaps) * 100) : 0;
        
        const kpiCount = showPrsSection ? 5 : 4;
        const boxWidth = Math.min(40, (pageWidth - margin * 2 - 30) / kpiCount);
        const spacing = (pageWidth - margin * 2 - boxWidth * kpiCount) / (kpiCount - 1);
        let kpiX = margin;
        if (showPrsSection) {
          addMetricBox('Current Score', currentScore.toString(), 'Latest readiness assessment score', kpiX, currentY, boxWidth);
          kpiX += boxWidth + spacing;
        }
        addMetricBox('Completion Rate', `${completionRate}%`, 'Checklist items completed', kpiX, currentY, boxWidth);
        kpiX += boxWidth + spacing;
        addMetricBox('Gap Plans', `${completedGapPlans}/${totalGapPlans}`, 'Completed vs. total gap plans', kpiX, currentY, boxWidth);
        kpiX += boxWidth + spacing;
        addMetricBox('Activities', activities.length.toString(), 'Total activities logged', kpiX, currentY, boxWidth);
        kpiX += boxWidth + spacing;
        addMetricBox('Sim. Gaps', `${completedSimGaps}/${totalSimGaps}`, 'Simulation gaps completed', kpiX, currentY, boxWidth);
        
        currentY += 50;
        
        // Progress Bars (like the progress indicators on the page)
        currentY = addProgressBar('Checklist Progress', completionRate, currentY, 'Overall completion rate of all checklist items across all stages');
        currentY = addProgressBar('Gap Plan Completion', gapCompletionRate, currentY, 'Percentage of gap plans that have been completed');
        if (totalSimGaps > 0) {
          currentY = addProgressBar('Simulation Gaps Completion', simGapCompletionRate, currentY, 'Percentage of simulation gaps completed');
        }
        
        // Page 2: Detailed Progress Analysis (like the detailed sections on the page)
        doc.addPage();
        currentY = titleY;
        
        currentY = addSectionHeader('Detailed Progress Analysis', currentY);
        
        // Checklist Progress by Stage (like the "Checklist Progress by Stage" section)
        currentY = addSectionHeader('Checklist Progress by Stage', currentY + 10);
        
        const stageProgress = milestones.reduce((acc, milestone) => {
          const stage = milestone.stage;
          if (!acc[stage]) {
            acc[stage] = { total: 0, completed: 0 };
          }
          acc[stage].total++;
          if (isMilestoneCompleted(milestone)) {
            acc[stage].completed++;
          }
          return acc;
        }, {} as Record<string, { total: number; completed: number }>);
        
        Object.entries(stageProgress).forEach(([stage, progress]) => {
          const stageData = progress as { total: number; completed: number };
          const stagePercentage = Math.round((stageData.completed / stageData.total) * 100);
          currentY = addProgressBar(`${stage}`, stagePercentage, currentY, `${stageData.completed} of ${stageData.total} items completed`);
        });
        
        // Gap Plan Status Distribution (like the "Gap Plan Status Distribution" section)
        currentY += 20;
        currentY = addSectionHeader('Gap Plan Status Distribution', currentY);
        
        const gapStatuses = gapPlans.reduce((acc, plan) => {
          acc[plan.status] = (acc[plan.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        Object.entries(gapStatuses).forEach(([status, count]) => {
          const countValue = count as number;
          const percentage = Math.round((countValue / totalGapPlans) * 100);
          currentY = addProgressBar(`${status}`, percentage, currentY, `${countValue} gap plans in ${status} status`);
        });
        
        // Simulation Gaps Status Distribution
        if (simulationGaps.length > 0) {
          currentY += 20;
          currentY = addSectionHeader('Simulation Gaps by Status', currentY);
          const simStatuses = simulationGaps.reduce((acc: Record<string, number>, g: any) => {
            const s = (g.status || 'identified') as string;
            acc[s] = (acc[s] || 0) + 1;
            return acc;
          }, {});
          Object.entries(simStatuses).forEach(([status, count]) => {
            const percentage = Math.round((count / totalSimGaps) * 100);
            currentY = addProgressBar(status.replace(/_/g, ' '), percentage, currentY, `${count} simulation gaps in ${status}`);
          });
        }
        
        // Page 3: Activity Summary & Trends (like the "Activity Category Distribution" section)
        doc.addPage();
        currentY = titleY;
        
        currentY = addSectionHeader('Activity Summary & Trends', currentY);
        
        currentY = addPdfSectionHeader(doc, pdfLayout, 'Activity Category Distribution', currentY + 10);
        currentY = addPdfHorizontalBarChart(
          doc,
          pdfLayout,
          'Activities logged by category',
          activityCategoryStats.map((row) => ({ label: row.label, value: row.count })),
          currentY
        );
        
        // PECC Work Hours Analysis (like the work hours section on the page)
        currentY += 20;
        currentY = addSectionHeader('PECC Work Hours Analysis', currentY);
        
        if (activities.length > 0) {
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          
          // Calculate hours for different time periods
          const thisMonthHours = activities
            .filter(a => {
              const activityDate = parseActivityDate(a.date);
              if (!activityDate) return false;
              return activityDate.getMonth() === currentMonth &&
                     activityDate.getFullYear() === currentYear;
            })
            .reduce((sum, a) => sum + (a.hours || 0), 0);
          
          const lastMonthHours = activities
            .filter(a => {
              const activityDate = parseActivityDate(a.date);
              if (!activityDate) return false;
              const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
              const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
              return activityDate.getMonth() === lastMonth &&
                     activityDate.getFullYear() === lastMonthYear;
            })
            .reduce((sum, a) => sum + (a.hours || 0), 0);
          
          const thisYearHours = activities
            .filter(a => {
              const activityDate = parseActivityDate(a.date);
              if (!activityDate) return false;
              return activityDate.getFullYear() === currentYear;
            })
            .reduce((sum, a) => sum + (a.hours || 0), 0);
          
          const totalHours = activities.reduce((sum, a) => sum + (a.hours || 0), 0);
          
          // Add hour metrics
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(33, 37, 41);
          doc.text('This Month:', margin, currentY);
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          doc.text(`${thisMonthHours} hours`, margin + 80, currentY);
          currentY += 15;
          
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Last Month:', margin, currentY);
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          doc.text(`${lastMonthHours} hours`, margin + 80, currentY);
          currentY += 15;
          
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('This Year:', margin, currentY);
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          doc.text(`${thisYearHours} hours`, margin + 80, currentY);
          currentY += 15;
          
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Total Hours:', margin, currentY);
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          doc.text(`${totalHours} hours`, margin + 80, currentY);
          currentY += 20;
        }
        
        // Recent Activities (like the recent activities section)
        currentY += 10;
        currentY = addSectionHeader('Recent Activities', currentY);
        
        const recentActivities = [...activities]
          .sort((a, b) => activityTime(b.date) - activityTime(a.date))
          .slice(0, 10);
        recentActivities.forEach((activity, index) => {
          if (currentY < pageHeight - margin) {
            doc.setFontSize(10);
            doc.setTextColor(33, 37, 41);
            doc.text(`${index + 1}. ${activity.activity || activity.title || 'Activity'}`, margin, currentY);
            doc.setFontSize(9);
            doc.setTextColor(108, 117, 125);
            
            // Wrap activity details to fit page width
            const detailsText = `${activity.date} - ${displayActivityCategories(activity)}${activity.submitted_by ? ` - Entered by: ${activitySubmitterById[activity.submitted_by] || activity.submitted_by}` : ''}`;
            const detailsY = addWrappedText(detailsText, margin + 10, currentY + 5, pageWidth - margin * 2 - 10, 9);
            currentY = detailsY + 5;
          }
        });
        
        // Page 4: Simulation Analytics & Participant Data
        if (activities.filter((a) => isSimulationActivity(a)).length > 0) {
          doc.addPage();
          currentY = titleY;
          
          currentY = addSectionHeader('Simulation Analytics & Participant Data', currentY);
          
          // Simulations by Type (like the simulation type chart on the page)
          currentY = addSectionHeader('Simulations by Type', currentY + 10);
          
          const simulationTypes = Array.from(new Set(activities
            .filter((a) => isSimulationActivity(a))
            .map(a => a.simulation || 'Other')));
          
          if (simulationTypes.length > 0) {
            const simTypeData = simulationTypes.map(simType => {
              const count = activities.filter(a => 
                isSimulationActivity(a) &&
                (a.simulation === simType || (a.simulation === undefined && simType === 'Other'))
              ).length;
              return {
                label: simType === 'Other' ? 'Other' : simType,
                value: count,
                color: '#2196F3' // Blue
              };
            });
            
            currentY = addChartSection('Simulation Types Distribution', simTypeData, currentY);
          }
          
          // Simulation Participants (like the participant chart on the page)
          currentY += 30;
          currentY = addSectionHeader('Simulation Participants', currentY);
          
          if (simulationTypes.length > 0) {
            const participantData = simulationTypes.map(simType => {
              const simActivities = activities.filter(a => 
                isSimulationActivity(a) &&
                (a.simulation === simType || (a.simulation === undefined && simType === 'Other'))
              );
              const totalParticipants = simActivities.reduce((sum, a) => sum + (a.participants || 0), 0);
              return {
                label: simType === 'Other' ? 'Other' : simType,
                value: totalParticipants,
                color: '#FF9800' // Orange
              };
            });
            
            currentY = addChartSection('Total Participants by Simulation Type', participantData, currentY);
            
            // Add participant statistics
            currentY += 20;
            currentY = addSectionHeader('Participant Statistics', currentY);
            
            simulationTypes.forEach(simType => {
              const simActivities = activities.filter(a => 
                isSimulationActivity(a) &&
                (a.simulation === simType || (a.simulation === undefined && simType === 'Other'))
              );
              const totalParticipants = simActivities.reduce((sum, a) => sum + (a.participants || 0), 0);
              const avgParticipants = simActivities.length > 0 ? Math.round(totalParticipants / simActivities.length) : 0;
              
              doc.setFontSize(10);
              doc.setTextColor(33, 37, 41);
              doc.text(`${simType === 'Other' ? 'Other' : simType}:`, margin, currentY);
              doc.setFontSize(9);
              doc.setTextColor(108, 117, 125);
              doc.text(`Total: ${totalParticipants}, Avg: ${avgParticipants}`, margin + 80, currentY);
              currentY += 12;
            });
          }
        }
        
        // Page 5: Readiness Score Trends & Analysis (only when PRS section is visible)
        if (showPrsSection && readinessScores.length > 0) {
          doc.addPage();
          currentY = titleY;
          
          currentY = addSectionHeader('Readiness Score Trends & Analysis', currentY);
          
          // Score progression with visual indicators (like the score trends on the page)
          readinessScores.forEach((score, index) => {
            if (currentY < pageHeight - margin) {
              doc.setFontSize(11);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(33, 37, 41);
              doc.text(`Assessment ${index + 1}: ${score.score}`, margin, currentY);
              doc.setFontSize(9);
              doc.setTextColor(108, 117, 125);
              doc.text(`Date: ${score.date}`, margin + 10, currentY + 5);
              
              // Add a visual progress indicator (like a mini chart)
              const scorePercentage = (score.score / 100) * 50; // Scale to 50px width
              doc.setDrawColor(224, 224, 224);
              doc.setFillColor(248, 249, 250);
              doc.rect(margin + 80, currentY - 2, 50, 6, 'FD');
              doc.setFillColor(76, 175, 80);
              doc.rect(margin + 80, currentY - 2, scorePercentage, 6, 'F');
              
              currentY += 15;
            }
          });
          
          // Improvement summary (like the trend analysis on the page)
          if (readinessScores.length > 1) {
            currentY += 10;
            const firstScore = readinessScores[0]?.score || 0;
            const lastScore = readinessScores[readinessScores.length - 1]?.score || 0;
            const improvement = lastScore - firstScore;
            
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(33, 37, 41);
            doc.text('Improvement Summary:', margin, currentY);
            currentY += 15;
            
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`Initial Score: ${firstScore}`, margin, currentY);
            currentY += 10;
            doc.text(`Latest Score: ${lastScore}`, margin, currentY);
            currentY += 10;
            doc.text(`Total Improvement: ${improvement > 0 ? '+' : ''}${improvement} points`, margin, currentY);
            currentY += 10;
            doc.text(`Average Improvement per Assessment: ${Math.round(improvement / (readinessScores.length - 1))} points`, margin, currentY);
          }
        }
        
        // Page 6: Gap Plan Priority & Status Analysis (like the gap plan sections on the page)
        if (gapPlans.length > 0) {
          doc.addPage();
          currentY = titleY;
          
          currentY = addSectionHeader('Gap Plan Priority & Status Analysis', currentY);
          
          // Gap Plan Status Distribution (like the status distribution on the page)
          currentY = addSectionHeader('Gap Plan Status Distribution', currentY + 10);
          
          const gapStatuses = gapPlans.reduce((acc, plan) => {
            acc[plan.status] = (acc[plan.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          Object.entries(gapStatuses).forEach(([status, count]) => {
            const countValue = count as number;
            const percentage = Math.round((countValue / totalGapPlans) * 100);
            currentY = addProgressBar(`${status}`, percentage, currentY, `${countValue} gap plans in ${status} status`);
          });
          
          // Gap Plan Priority Breakdown (like the priority breakdown on the page)
          currentY += 20;
          currentY = addSectionHeader('Gap Plan Priority Breakdown', currentY);
          
          const priorityBreakdown = gapPlans.reduce((acc, plan) => {
            const priority = plan.priority || 'Not Set';
            acc[priority] = (acc[priority] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          Object.entries(priorityBreakdown).forEach(([priority, count]) => {
            const countValue = count as number;
            const percentage = Math.round((countValue / totalGapPlans) * 100);
            currentY = addProgressBar(`${priority} Priority`, percentage, currentY, `${countValue} gap plans with ${priority} priority`);
          });
          
          // Gap Plan Status by Priority (like the detailed breakdown on the page)
          currentY += 20;
          currentY = addSectionHeader('Gap Plan Status by Priority', currentY);
          
          const priorityStatuses = gapPlans.reduce((acc, plan) => {
            const priority = plan.priority || 'Not Set';
            if (!acc[priority]) {
              acc[priority] = {};
            }
            const status = plan.status;
            acc[priority][status] = (acc[priority][status] || 0) + 1;
            return acc;
          }, {} as Record<string, Record<string, number>>);
          
          Object.entries(priorityStatuses).forEach(([priority, statuses]) => {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(33, 37, 41);
            doc.text(`${priority} Priority:`, margin, currentY);
            currentY += 10;
            
            const statusEntries = statuses as Record<string, number>;
            Object.entries(statusEntries).forEach(([status, count]) => {
              doc.setFontSize(9);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(108, 117, 125);
              doc.text(`  ${status}: ${count}`, margin + 10, currentY);
              currentY += 8;
            });
            currentY += 5;
          });
        }
        
        // Page 7: Comprehensive Activity Analysis
        doc.addPage();
        currentY = titleY;
        
        currentY = addSectionHeader('Comprehensive Activity Analysis', currentY);
        
        currentY = addPdfSectionHeader(doc, pdfLayout, 'Activity Category Distribution with Hours', currentY + 10);
        if (activityCategoryStats.length > 0) {
          const categoryRows: CategoryHoursRow[] = activityCategoryStats.map((row) => ({
            label: row.label,
            count: row.count,
            hours: row.hours,
          }));
          currentY = addPdfCategoryHoursTable(doc, pdfLayout, categoryRows, currentY);
          currentY = addPdfHorizontalBarChart(
            doc,
            pdfLayout,
            'Hours invested by category',
            activityCategoryStats.map((row) => ({ label: row.label, value: row.hours })),
            currentY + 6,
            'h'
          );
        }
        
        // Page 8: Recommendations & Next Steps
        doc.addPage();
        currentY = titleY;
        
        currentY = addSectionHeader('Strategic Recommendations & Next Steps', currentY);
        
        // Generate intelligent recommendations based on all the data
        const recommendations = [];
        
        if (completionRate < 50) {
          recommendations.push('Focus on completing foundational checklist items to build momentum and establish baseline readiness');
        }
        if (gapCompletionRate < 30) {
          recommendations.push('Prioritize gap plan completion to address critical readiness areas and demonstrate measurable improvement');
        }
        if (activities.length < 5) {
          recommendations.push('Increase activity logging to track progress, demonstrate engagement, and provide evidence of ongoing work');
        }
        if (showPrsSection && readinessScores.length < 2) {
          recommendations.push('Complete additional readiness assessments to establish baseline, track progress, and identify trends');
        }
        if (totalGapPlans === 0) {
          recommendations.push('Develop gap plans based on assessment results to create actionable improvement strategies');
        }
        
        if (recommendations.length === 0) {
          recommendations.push('Excellent progress! Continue maintaining current momentum and consider mentoring others in your organization');
          recommendations.push('Focus on sustainability and long-term maintenance of pediatric readiness standards');
        }
        
        // Add specific recommendations based on data patterns (only when PRS section is visible)
        if (showPrsSection && readinessScores.length > 1) {
          const firstScore = readinessScores[0]?.score || 0;
          const lastScore = readinessScores[readinessScores.length - 1]?.score || 0;
          const improvement = lastScore - firstScore;
          
          if (improvement < 10) {
            recommendations.push('Consider focusing on high-impact checklist items and gap plans to accelerate improvement');
          } else if (improvement > 20) {
            recommendations.push('Strong improvement trend! Share best practices with colleagues and document successful strategies');
          }
        }
        
        recommendations.forEach((rec, index) => {
          if (currentY < pageHeight - margin) {
            doc.setFontSize(11);
            doc.setTextColor(33, 37, 41);
            doc.text(`${index + 1}. `, margin, currentY);
            
            // Wrap recommendation text to fit page width
            const recText = rec;
            const recY = addWrappedText(recText, margin + 15, currentY, pageWidth - margin * 2 - 15, 11);
            currentY = recY + 5;
          }
        });
        
        // Footer with branding
        doc.setFontSize(9);
        doc.setTextColor(108, 117, 125);
        doc.text('Generated by ImPACTS PECC Tracker - Comprehensive Pediatric Readiness Assessment Tool', pageWidth / 2, pageHeight - 10, { align: 'center' });
        
        return doc;
      };
      
      const doc = createComprehensiveReport();
      if (!doc) return;
      doc.save(`PECC_Comprehensive_Snapshot_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      setPdfSnackbar({
        open: true,
        message: 'PDF downloaded. The report includes KPIs, progress, activities, and recommendations from this page.',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error creating comprehensive snapshot report:', error);
      setPdfSnackbar({
        open: true,
        message: 'Error creating report. Please try again.',
        severity: 'error'
      });
    }
  };


  if (isLoading) {
    return (
      <Box sx={{ bgcolor: 'grey.50', minHeight: '70vh', py: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Paper elevation={0} sx={{ p: 4, maxWidth: 400, width: '100%', mx: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Loading snapshot
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pulling your latest metrics and activity data…
          </Typography>
          <LinearProgress sx={{ borderRadius: 1 }} />
        </Paper>
      </Box>
    );
  }

  if (hasError) {
    return (
      <Box sx={{ bgcolor: 'grey.50', minHeight: '70vh', py: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Paper elevation={0} sx={{ p: 4, maxWidth: 440, width: '100%', mx: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom color="error" sx={{ fontWeight: 600 }}>
            Couldn&apos;t load snapshot
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Check your connection and try again.
          </Typography>
          <Button variant="contained" onClick={() => setRetryCount(c => c + 1)} sx={{ mr: 1 }}>
            Retry
          </Button>
          <Button variant="outlined" onClick={() => window.location.reload()}>
            Refresh page
          </Button>
        </Paper>
      </Box>
    );
  }

  const scoreTrend =
    readinessScores.length >= 2
      ? readinessScores[readinessScores.length - 1].score - readinessScores[0].score
      : 0;

  return (
    <>
      <Box
        sx={{
          bgcolor: 'grey.50',
          minHeight: '100%',
          pb: { xs: 4, md: 6 },
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, maxWidth: { xl: '1200px !important' } }}>
        {/* Header — product-style hero */}
        <Stack spacing={3} sx={{ mb: 3 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 3.5 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              background: (theme) =>
                `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${theme.palette.background.paper} 55%, ${alpha(theme.palette.grey[100], 0.5)} 100%)`
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ maxWidth: { md: 'min(100%, 560px)' } }}>
                <Typography
                  variant="overline"
                  sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: 0.08, display: 'block', mb: 1 }}
                >
                  Performance overview
                </Typography>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 700, letterSpacing: -0.02, mb: 1 }}>
                  Snapshot
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.65, fontSize: { xs: '0.95rem', sm: '1rem' } }}>
                  One place for readiness trend, checklist and gap work, activities, and simulations—consistent with your other tabs.
                  Export a PDF when you need to share progress offline.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                <Button size="small" variant="outlined" onClick={() => navigate('/activities')}>
                  Activities
                </Button>
                <Button size="small" variant="outlined" onClick={() => navigate('/milestones')}>
                  Checklist
                </Button>
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={<PictureAsPdfIcon />}
                  onClick={exportToComprehensivePDF}
                  sx={{
                    px: 2,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: 'none',
                    bgcolor: 'grey.900',
                    '&:hover': { bgcolor: 'grey.800', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }
                  }}
                >
                  Export PDF
                </Button>
              </Stack>
            </Box>
          </Paper>

          {!effectiveHospitalId && (
            <Alert severity="warning" variant="outlined">
              Your account is not linked to a hospital site yet. Some metrics use personal saved data only. Ask your
              mentor or manager to confirm hospital assignment in the CRM, then refresh this page.
            </Alert>
          )}

          {checklistMetrics.source === 'site_checklist' && (
            <Alert severity="info" variant="outlined">
              Checklist progress is synced from your site checklist (same data as the Checklist tab).
            </Alert>
          )}

          {/* Quick Stats Banner - Only show if PRS section is visible */}
          {showPrsSection && readinessScores.length > 0 && (
            <Alert 
              severity="info" 
              sx={{ 
                mb: 3,
                '& .MuiAlert-message': { width: '100%' }
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    Latest Assessment Score: {readinessScores[readinessScores.length - 1]?.score || 'N/A'}
                  </Typography>
                  {readinessScores.length > 1 && (
                    <Typography variant="body2">
                      {scoreTrend > 0 ? (
                        <Box component="span" sx={{ color: 'success.main', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                          <ArrowUpwardIcon fontSize="small" /> +{scoreTrend} points improvement
                        </Box>
                      ) : scoreTrend < 0 ? (
                        <Box component="span" sx={{ color: 'error.main', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                          <ArrowDownwardIcon fontSize="small" /> {scoreTrend} points
                        </Box>
                      ) : (
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                          <RemoveIcon fontSize="small" /> No change
                        </Box>
                      )}
                      {' '}since first assessment
                    </Typography>
                  )}
                </Box>
                {currentPRSScore !== null && (
                  <Chip 
                    label={`Current Live PRS: ${currentPRSScore}%`} 
                    color="primary" 
                    variant="outlined"
                    sx={{ fontWeight: 'bold' }}
                  />
                )}
              </Box>
            </Alert>
          )}
        </Stack>

        <Divider sx={{ my: 1 }} />

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.08, textTransform: 'uppercase', fontSize: '0.7rem' }}>
            Key metrics
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            High-level numbers from your saved data. PRS cards appear when that section is enabled.
          </Typography>
        </Box>
        <Box
          sx={{
            mb: 4,
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: showPrsSection ? 'repeat(5, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))'
            }
          }}
        >
          {showPrsSection && (
            <Box>
              <Card sx={metricCardSx}>
                <CardContent sx={{ textAlign: 'center', p: 3 }}>
                  <Box sx={{ 
                    display: 'inline-flex', 
                    p: 1.5, 
                    borderRadius: '50%', 
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.12), 
                    mb: 2 
                  }}>
                    <TrendingUpIcon sx={{ fontSize: 28, color: 'primary.main' }} />
                  </Box>
                  <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {readinessScores.length > 0 
                      ? readinessScores[readinessScores.length - 1]?.score || 'N/A' 
                      : currentPRSScore !== null ? currentPRSScore : 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    Current Readiness Score
                  </Typography>
                  {readinessScores.length > 1 && (
                    <Typography variant="caption" color={scoreTrend >= 0 ? 'success.main' : 'error.main'} sx={{ mt: 0.5, display: 'block' }}>
                      {scoreTrend >= 0 ? '↑' : '↓'} {Math.abs(scoreTrend)} from first
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}
          
          <Box>
            <Card sx={metricCardSx}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ 
                  display: 'inline-flex', 
                  p: 1.5, 
                  borderRadius: '50%', 
                  bgcolor: (t) => alpha(t.palette.success.main, 0.12), 
                  mb: 2 
                }}>
                  <CheckCircleIcon sx={{ fontSize: 28, color: 'success.main' }} />
                </Box>
                <Typography variant="h3" color="success.main" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  {checklistMetrics.totalTasks > 0 ? checklistMetrics.kpiLabel : '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Checklist Progress
                </Typography>
                {checklistMetrics.totalTasks > 0 && (
                  <LinearProgress 
                    variant="determinate" 
                    value={checklistMetrics.overallPct}
                    sx={{ mt: 1, height: 6, borderRadius: 3 }}
                  />
                )}
              </CardContent>
            </Card>
          </Box>
          
          <Box>
            <Card sx={metricCardSx}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ 
                  display: 'inline-flex', 
                  p: 1.5, 
                  borderRadius: '50%', 
                  bgcolor: (t) => alpha(t.palette.warning.main, 0.15), 
                  mb: 2 
                }}>
                  <AssessmentIcon sx={{ fontSize: 28, color: 'warning.main' }} />
                </Box>
                <Typography variant="h3" color="warning.main" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  {gapPlans.length}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Total Gap Plans
                </Typography>
                {gapPlans.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {gapPlans.filter((p: any) => isGapPlanCompleted(p)).length} completed
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
          
          <Box>
            <Card sx={metricCardSx}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ 
                  display: 'inline-flex', 
                  p: 1.5, 
                  borderRadius: '50%', 
                  bgcolor: (t) => alpha(t.palette.info.main, 0.12), 
                  mb: 2 
                }}>
                  <WorkIcon sx={{ fontSize: 28, color: 'info.main' }} />
                </Box>
                <Typography variant="h3" color="info.main" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  {activities.length}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Total Activities
                </Typography>
                {activities.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {activities.reduce((sum: number, a: any) => sum + (a.hours || 0), 0).toFixed(1)} hours logged
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>

          <Box>
            <Card sx={metricCardSx}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ 
                  display: 'inline-flex', 
                  p: 1.5, 
                  borderRadius: '50%', 
                  bgcolor: (t) => alpha(t.palette.secondary.main, 0.12), 
                  mb: 2 
                }}>
                  <SlideshowIcon sx={{ fontSize: 28, color: 'secondary.main' }} />
                </Box>
                <Typography variant="h3" color="secondary.main" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  {simulationGaps.length}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Simulation Gaps
                </Typography>
                {simulationGaps.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {simulationGaps.filter((g: any) => isSimulationGapCompleted(g)).length} completed
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>

      {/* Progress Overview: Checklist (overall + by stage in one card) and Gap Plans */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Checklist Progress
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {checklistMetrics.source === 'site_checklist'
                  ? 'Progress from your site checklist tasks (matches the Checklist tab).'
                  : 'Milestone checklist completion. If your program uses stages with tasks, progress is counted by completed tasks.'}
              </Typography>
              <Box sx={{ mt: 2 }}>
                {checklistMetrics.totalTasks > 0 ? (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Overall Progress</Typography>
                      <Typography variant="body2">{checklistMetrics.overallPct}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={checklistMetrics.overallPct} sx={{ height: 8, borderRadius: 4 }} />
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {checklistMetrics.completedTasks} of {checklistMetrics.totalTasks} completed
                      </Typography>
                      <Button size="small" onClick={() => navigate('/milestones')}>
                        Open checklist
                      </Button>
                    </Box>
                    {checklistMetrics.source === 'milestones_staged' && milestones[0]?.tasks != null && (
                      <>
                        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1.5, fontWeight: 600 }}>Progress by Stage</Typography>
                        <Grid container spacing={2}>
                          {milestones.map((stage: any) => {
                            const totalTasks = stage.tasks?.length || 0;
                            const completedTasks = stage.tasks?.filter((task: any) => task.completed)?.length || 0;
                            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                            return (
                              <Grid item xs={12} sm={6} key={stage.id}>
                                <Box sx={{ mb: 1 }}>
                                  <Typography variant="body2" color="primary.main" sx={{ fontWeight: 500 }}>
                                    {stage.title}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {completedTasks} of {totalTasks} tasks · {progress}%
                                  </Typography>
                                  <LinearProgress
                                    variant="determinate"
                                    value={progress}
                                    sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                                  />
                                </Box>
                              </Grid>
                            );
                          })}
                        </Grid>
                      </>
                    )}
                  </>
                ) : (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      No checklist progress recorded yet.
                    </Typography>
                    <Button size="small" variant="outlined" onClick={() => navigate('/milestones')}>
                      Go to Checklist
                    </Button>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Gap Plan Completion Overview
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Counts by status from your gap plan list (same labels as the Gap Plan tab).
              </Typography>
              <Box sx={{ mt: 2 }}>
                {gapPlans.length > 0 ? (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">In Progress</Typography>
                      <Typography variant="body2">
                        {gapPlans.filter(p => gapPlanHasStatus(p, 'In Progress')).length}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Completed</Typography>
                      <Typography variant="body2">
                        {gapPlans.filter(p => gapPlanHasStatus(p, 'Completed')).length}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Needs Update</Typography>
                      <Typography variant="body2">
                        {gapPlans.filter(p => gapPlanHasStatus(p, 'Needs Update')).length}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Need to Develop</Typography>
                      <Typography variant="body2">
                        {gapPlans.filter(p => gapPlanHasStatus(p, 'Need to Develop')).length}
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No gap plans data available
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activities (with submitter)
              </Typography>
              {activities.length > 0 ? (
                <Stack spacing={1}>
                  {[...activities]
                    .sort((a, b) => activityTime(b.date) - activityTime(a.date))
                    .slice(0, 8)
                    .map((a, idx) => (
                      <Box key={`${a.id || idx}`} sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {a.activity || a.title || 'Activity'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatActivityDateLabel(a.date)} • {displayActivityCategories(a)}
                        </Typography>
                        {a.submitted_by && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Entered by: {activitySubmitterById[a.submitted_by] || a.submitted_by}
                          </Typography>
                        )}
                      </Box>
                    ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No activities recorded</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />
      <Box sx={{ mb: 2 }}>
        <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 0.12, color: 'text.secondary', display: 'block' }}>
          Simulations
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Facilitation activity and participants from your Activities log.
        </Typography>
      </Box>

      {/* Simulation Analytics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Simulations by Type
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    Includes Simulation Facilitation and SC-tagged activities
                  </Typography>
                  <SnapshotBarChart
                    data={simulationTypeData}
                    valueLabel="Simulations"
                    emptyMessage="No simulation activities recorded"
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Simulation Participants
                  </Typography>
                  <SnapshotBarChart
                    data={simulationParticipantData}
                    valueLabel="Participants"
                    emptyMessage="No simulation activities recorded"
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>






      <Divider sx={{ my: 3 }} />
      <Box sx={{ mb: 2 }}>
        <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 0.12, color: 'text.secondary', display: 'block' }}>
          Gap plans — detail
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Status mix and priorities beyond the summary cards above.
        </Typography>
      </Box>

      {/* Gap Plan Analytics - Action Planning Status */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Gap Plan Status Distribution
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    {gapPlans.length > 0 ? (
                      <>
                        {(() => {
                          const statusCounts = gapPlans.reduce((acc, plan) => {
                            const status = plan.status || 'Not Set';
                            acc[status] = (acc[status] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>);
                          
                          const totalPlans = gapPlans.length;
                          const completedPlans = gapPlans.filter(isGapPlanCompleted).length;
                          const completionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;
                          
                          return (
                            <>
                              <Box sx={{ mb: 3, textAlign: 'center', p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                                <Typography variant="h4" color="white">
                                  {completionRate}%
                                </Typography>
                                <Typography variant="body2" color="white">
                                  Completion Rate
                                </Typography>
                                <Typography variant="caption" color="white">
                                  {completedPlans} of {totalPlans} plans completed
                                </Typography>
                              </Box>
                              <Grid container spacing={1}>
                                {Object.entries(statusCounts).map(([status, count]) => (
                                  <Grid item xs={6} key={status}>
                                    <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
                                      <Typography variant="h6" color="primary.main">
                                        {count as number}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {status as string}
                                      </Typography>
                                    </Box>
                                  </Grid>
                                ))}
                              </Grid>
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No gap plans available
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Gap Plan Priority Breakdown
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    {gapPlans.length > 0 ? (
                      <>
                        {(() => {
                          const priorityCounts = gapPlans.reduce((acc, plan) => {
                            const priority = plan.priority || 'Not Set';
                            acc[priority] = (acc[priority] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>);
                          
                          const highPriority = (priorityCounts['High Importance & High Urgency (Do Now)'] || 0) + 
                                             (priorityCounts['High Importance & Low Urgency (Do Next)'] || 0);
                          
                          return (
                            <>
                              <Box sx={{ mb: 3, textAlign: 'center', p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                                <Typography variant="h4" color="white">
                                  {highPriority}
                                </Typography>
                                <Typography variant="body2" color="white">
                                  High Priority Plans
                                </Typography>
                              </Box>
                              <Grid container spacing={1}>
                                {Object.entries(priorityCounts).map(([priority, count]) => (
                                  <Grid item xs={12} key={priority}>
                                    <Box sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <Typography variant="body2" sx={{ flex: 1 }}>
                                        {(priority as string).replace(/\([^)]*\)/g, '').trim()}
                                      </Typography>
                                      <Typography variant="h6" color="primary.main">
                                        {count as number}
                                      </Typography>
                                    </Box>
                                  </Grid>
                                ))}
                              </Grid>
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No gap plans available
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

      {/* Simulation Gaps Analytics - From Simulation tab */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Simulation Gaps by Status
              </Typography>
              <Box sx={{ mt: 2 }}>
                {simulationGaps.length > 0 ? (
                  <Grid container spacing={2}>
                    {(() => {
                      const statusCounts = simulationGaps.reduce((acc, g) => {
                        const s = (g.status || 'identified') as string;
                        acc[s] = (acc[s] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);
                      const total = simulationGaps.length;
                      return Object.entries(statusCounts).map(([status, count]) => {
                        const n = count as number;
                        return (
                        <Grid item xs={12} key={status}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                              {status.replace(/_/g, ' ')}
                            </Typography>
                            <Typography variant="body2" color="primary.main">
                              {`${n} (${Math.round((n / total) * 100)}%)`}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={(n / total) * 100}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Grid>
                      ); });
                    })()}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No simulation gaps recorded. Add gaps from the Simulation tab.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Simulation Gaps by Severity
              </Typography>
              <Box sx={{ mt: 2 }}>
                {simulationGaps.length > 0 ? (
                  <Grid container spacing={2}>
                    {(() => {
                      const severityCounts = simulationGaps.reduce((acc, g) => {
                        const s = (g.severity || 'other') as string;
                        acc[s] = (acc[s] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);
                      const total = simulationGaps.length;
                      return Object.entries(severityCounts).map(([severity, count]) => {
                        const n = count as number;
                        return (
                        <Grid item xs={12} key={severity}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                              {severity}
                            </Typography>
                            <Typography variant="body2" color="primary.main">
                              {`${n} (${Math.round((n / total) * 100)}%)`}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={(n / total) * 100}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Grid>
                      ); });
                    })()}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No simulation gaps recorded
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />
      <Box sx={{ mb: 2 }}>
        <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 0.12, color: 'text.secondary', display: 'block' }}>
          Activities &amp; hours
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Category mix and time logged—same data as the Activities tab.
        </Typography>
      </Box>

      {/* Activity Analysis - Work Tracking and Insights */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={7}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Activity categories
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Full category names with activity counts—optimized for leadership review and export.
              </Typography>
              {activityCategoryStats.length > 0 ? (
                <SnapshotHorizontalBarChart
                  data={activityCategoryStats.map((row) => ({
                    label: row.label,
                    value: row.count,
                    sublabel: `${row.hours.toFixed(1)} hrs`,
                  }))}
                  valueLabel="Activities"
                  minHeight={300}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No activities data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Hours by category
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Where PECC time is invested across readiness work.
              </Typography>
              {activityCategoryStats.length > 0 ? (
                <Stack spacing={1.25}>
                  {activityCategoryStats.map((row, index) => (
                    <Box
                      key={row.label}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        bgcolor: index % 2 === 0 ? 'grey.50' : 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.45, mb: 0.5 }}>
                        {row.label}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          {row.count} {row.count === 1 ? 'activity' : 'activities'}
                        </Typography>
                        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
                          {row.hours.toFixed(1)} hrs
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No activities recorded
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                PECC Work Hours Analysis
              </Typography>
              <Box sx={{ mt: 2 }}>
                {activities.length > 0 ? (
                  <Grid container spacing={2}>
                    {[
                      { label: 'This Month', value: workHours.thisMonthHours, bgcolor: 'primary.light' },
                      { label: 'Last Month', value: workHours.lastMonthHours, bgcolor: 'secondary.light' },
                      { label: 'This Year', value: workHours.thisYearHours, bgcolor: 'success.light' },
                      { label: 'Total Hours', value: workHours.totalHours, bgcolor: 'warning.light' },
                    ].map((tile) => (
                      <Grid item xs={6} sm={3} key={tile.label}>
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: tile.bgcolor, borderRadius: 1 }}>
                          <Typography variant="h4" color="white">
                            {Number(tile.value).toFixed(1)}
                          </Typography>
                          <Typography variant="body2" color="white">
                            {tile.label}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No activities recorded
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Divider sx={{ my: 3 }} />
      <Box sx={{ mb: 1 }}>
        <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 0.12, color: 'primary.main', display: 'block' }}>
          Pediatric readiness
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0 }}>
          Score trends and charts align with your Dashboard readiness entries when this section is visible.
        </Typography>
      </Box>

      {/* Readiness Score Trend & Progress - hidden by default; user can show */}
      {showPrsSection && snapshotReadinessChartsVisible === false && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Readiness Score Trend and Readiness Score Progress Over Time are hidden.
          </Typography>
          <Button size="small" variant="text" onClick={() => setReadinessChartsVisiblePref(true)} sx={{ mt: 1, p: 0 }}>
            Show Readiness Score Trend &amp; Progress
          </Button>
        </Box>
      )}
      {showPrsSection && snapshotReadinessChartsVisible !== false && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Button size="small" variant="outlined" onClick={() => setReadinessChartsVisiblePref(false)}>
            Hide Readiness Score Trend &amp; Progress
          </Button>
        </Box>
      )}
      {/* Readiness Assessment Progress - Core Mission Metrics - Only show if PRS and charts visible */}
      {showPrsSection && snapshotReadinessChartsVisible !== false && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Readiness Score Trend
                </Typography>
              <Box sx={{ mt: 2 }}>
                {readinessScores.length > 0 ? (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Latest Score</Typography>
                      <Typography variant="body2" color="primary.main">
                        {readinessScores[readinessScores.length - 1]?.score || 'N/A'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Average Score</Typography>
                      <Typography variant="body2">
                        {Math.round(readinessScores.reduce((sum, score) => sum + score.score, 0) / readinessScores.length)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Highest Score</Typography>
                      <Typography variant="body2" color="success.main">
                        {Math.max(...readinessScores.map(s => s.score))}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Total Assessments</Typography>
                      <Typography variant="body2">
                        {readinessScores.length}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Current Live PRS</Typography>
                      <Typography variant="body2" color="warning.main" sx={{ fontWeight: 'bold' }}>
                        {currentPRSScore !== null ? `${currentPRSScore}%` : 'N/A'}
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No readiness scores available
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        </Grid>
      )}

        {/* Readiness Score Progress Chart - Enhanced - Only show if PRS and charts visible */}
        {showPrsSection && snapshotReadinessChartsVisible !== false && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                      Readiness Score Progress Over Time
                    </Typography>
                    {readinessScores.length > 0 && (
                      <Chip 
                        label={`${readinessScores.length} Assessment${readinessScores.length !== 1 ? 's' : ''}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    )}
                  </Box>
              
                {/* Trend Metrics Section - Enhanced */}
                {readinessScores.length > 0 && (
                  <Box sx={{ mb: 3, p: 3, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                      Key Metrics
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'white' }}>
                          <Typography variant="h4" color="primary.main" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                            {readinessScores[readinessScores.length - 1]?.score || 0}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                            Latest Score
                          </Typography>
                          {readinessScores.length > 1 && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              {format(new Date(readinessScores[readinessScores.length - 1]?.date || new Date()), 'MMM d, yyyy')}
                            </Typography>
                          )}
                        </Paper>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'white' }}>
                          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                            {Math.round(readinessScores.reduce((sum, score) => sum + score.score, 0) / readinessScores.length)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                            Average Score
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'white' }}>
                          <Typography variant="h4" color="success.main" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                            {Math.max(...readinessScores.map(s => s.score))}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                            Highest Score
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'white' }}>
                          <Typography variant="h4" color="warning.main" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                            {currentPRSScore !== null ? `${currentPRSScore}%` : 'N/A'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                            Current Live PRS
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                    
                    {/* Progress Trend Summary */}
                    {readinessScores.length >= 2 && (
                      <Box sx={{ mt: 3, p: 2, bgcolor: scoreTrend >= 0 ? 'success.light' : 'error.light', borderRadius: 1 }}>
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={12} sm={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {scoreTrend > 0 && <ArrowUpwardIcon sx={{ color: 'success.main' }} />}
                              {scoreTrend < 0 && <ArrowDownwardIcon sx={{ color: 'error.main' }} />}
                              {scoreTrend === 0 && <RemoveIcon sx={{ color: 'text.secondary' }} />}
                              <Typography variant="body1" sx={{ fontWeight: 'bold', color: scoreTrend >= 0 ? 'success.dark' : 'error.dark' }}>
                                Progress Trend: {scoreTrend > 0 ? `+${scoreTrend.toFixed(1)}` : scoreTrend < 0 ? scoreTrend.toFixed(1) : '0'} points 
                                {scoreTrend > 0 ? ' improvement' : scoreTrend < 0 ? ' decline' : ' change'} since first assessment
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Total Assessments: {readinessScores.length} • 
                              First: {format(new Date(readinessScores[0]?.date || new Date()), 'MMM d, yyyy')} • 
                              Latest: {format(new Date(readinessScores[readinessScores.length - 1]?.date || new Date()), 'MMM d, yyyy')}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    )}
                  </Box>
                )}
              
              <PeccReadinessTrendChart
                scores={readinessScores}
                liveScore={currentPRSScore}
                height={400}
              />
              {/* Assessment list - same card, below chart (no duplicate section) */}
              {readinessScores.length > 0 && (
                <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Assessment History</Typography>
                  {[...readinessScores]
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((score, index, sorted) => (
                      <Box key={score.id || `${score.date}-${index}`} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            Assessment #{index + 1}
                          </Typography>
                          <Typography variant="h6" color="primary.main">
                            {score.score}%
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatActivityDateLabel(score.date)}
                          </Typography>
                          {index > 0 && (
                            <Typography
                              variant="caption"
                              color={score.score > sorted[index - 1].score ? 'success.main' : 'error.main'}
                              sx={{ fontWeight: 500 }}
                            >
                              {score.score > sorted[index - 1].score ? '↗' : '↘'}
                              {Math.abs(score.score - sorted[index - 1].score).toFixed(1)} pts
                            </Typography>
                          )}
                        </Box>
                        {score.notes && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Notes: {score.notes}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
                    <Typography variant="body2" color="primary.main">
                      Progress Trend: {readinessScores.length < 2 ? 'Insufficient data' : (() => {
                        const firstScore = readinessScores[0].score;
                        const lastScore = readinessScores[readinessScores.length - 1].score;
                        const improvement = lastScore - firstScore;
                        if (improvement > 0) return `+${improvement.toFixed(1)} points improvement`;
                        if (improvement < 0) return `${improvement.toFixed(1)} points decline`;
                        return 'No change';
                      })()}
                    </Typography>
                    <Typography variant="body2" color="primary.main">
                      Total Assessments: {readinessScores.length}
                    </Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        </Grid>
      )}



        {/* Domain Performance Analysis - Only show if PRS section is visible */}
        {showPrsSection && domainScores && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                      Domain Performance Analysis
                    </Typography>
                    <Chip 
                      label="Based on Current PRS Assessment" 
                      color="primary" 
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  
                  <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                    {/* Header Row */}
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr 1fr' },
                      bgcolor: 'primary.main',
                      color: 'white',
                      fontWeight: 'bold',
                      '& > div': { p: 2 }
                    }}>
                      <Box>Domain of Pediatric Readiness</Box>
                      <Box sx={{ textAlign: 'center', display: { xs: 'none', md: 'block' } }}>Your Points</Box>
                      <Box sx={{ textAlign: 'center', display: { xs: 'none', md: 'block' } }}>Total Possible</Box>
                      <Box sx={{ textAlign: 'center', display: { xs: 'none', md: 'block' } }}>Percentage</Box>
                    </Box>
                    
                    {/* Data Rows */}
                    {Object.entries(domainScores).map(([domain, data], index) => {
                      const getColorForPercentage = (pct: number) => {
                        if (pct >= 80) return 'success.main';
                        if (pct >= 60) return 'warning.main';
                        return 'error.main';
                      };
                      
                      return (
                        <Box 
                          key={domain}
                          sx={{ 
                            display: 'grid', 
                            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr 1fr' },
                            borderBottom: index < Object.keys(domainScores).length - 1 ? '1px solid' : 'none',
                            borderColor: 'divider',
                            '&:hover': { bgcolor: 'action.hover' },
                            '& > div': { p: 2, display: 'flex', alignItems: 'center' }
                          }}
                        >
                          <Box sx={{ fontWeight: 600 }}>{domain}</Box>
                          <Box sx={{ justifyContent: 'center', display: { xs: 'none', md: 'flex' } }}>
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                              {data.earned.toFixed(1)}
                            </Typography>
                          </Box>
                          <Box sx={{ justifyContent: 'center', display: { xs: 'none', md: 'flex' } }}>
                            <Typography variant="body2" color="text.secondary">
                              {data.total}
                            </Typography>
                          </Box>
                          <Box sx={{ justifyContent: 'space-between', flexDirection: { xs: 'column', md: 'row' }, gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                              <LinearProgress 
                                variant="determinate" 
                                value={data.percentage} 
                                sx={{ 
                                  flex: 1, 
                                  height: 8, 
                                  borderRadius: 4,
                                  bgcolor: 'grey.200',
                                  '& .MuiLinearProgress-bar': {
                                    bgcolor: getColorForPercentage(data.percentage)
                                  }
                                }}
                              />
                              <Typography 
                                variant="body1" 
                                sx={{ 
                                  fontWeight: 'bold',
                                  minWidth: '50px',
                                  textAlign: 'right',
                                  color: getColorForPercentage(data.percentage)
                                }}
                              >
                                {data.percentage}%
                              </Typography>
                            </Box>
                            {/* Mobile view */}
                            <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'space-between', fontSize: '0.875rem', color: 'text.secondary' }}>
                              <span>{data.earned.toFixed(1)} / {data.total} points</span>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                  </Paper>
                  
                  {!domainScores && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Complete your PRS assessment to see domain-specific performance breakdown.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {showPrsSection && domainScores && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                    Domain Performance Visualization
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Percentage score by PRS domain from your current assessment
                  </Typography>
                  <SnapshotHorizontalBarChart
                    data={domainBarData}
                    valueLabel="%"
                    minHeight={320}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 2, flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary">
                      ≥80% excellent · 60–79% good · &lt;60% needs improvement
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}


      </Container>
      </Box>
      <Snackbar
        open={pdfSnackbar.open}
        autoHideDuration={6000}
        onClose={() => setPdfSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={pdfSnackbar.severity}
          onClose={() => setPdfSnackbar(s => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {pdfSnackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default SnapshotPage;
