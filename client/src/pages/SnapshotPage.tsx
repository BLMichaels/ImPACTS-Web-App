import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  LinearProgress,
  Button,
  Chip,
  Alert,
  Container,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
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
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
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

const sectionShellSx = {
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  overflow: 'hidden',
} as const;

/** Matches Checklist tab defaults / admin milestone_stage_palette. */
const DEFAULT_STAGE_PALETTE: Record<'stage1' | 'stage2' | 'stage3' | 'stage4', string> = {
  stage1: '#2196F3',
  stage2: '#4CAF50',
  stage3: '#FF9800',
  stage4: '#9C27B0',
};

const resolveStageBarColor = (
  stage: { id?: string; title?: string; color_hex?: string | null },
  index: number,
  palette: typeof DEFAULT_STAGE_PALETTE
): string => {
  if (stage.color_hex) return stage.color_hex;
  const id = String(stage.id || '').toLowerCase();
  const title = String(stage.title || '').toLowerCase();
  if (id === 'stage1' || id.includes('stage1') || title.includes('establish')) return palette.stage1;
  if (id === 'stage2' || id.includes('stage2') || title.includes('implement')) return palette.stage2;
  if (id === 'stage3' || id.includes('stage3') || title.includes('lead')) return palette.stage3;
  if (id === 'stage4' || id.includes('stage4') || title.includes('sustain')) return palette.stage4;
  const keys = ['stage1', 'stage2', 'stage3', 'stage4'] as const;
  return palette[keys[index % 4]];
};

const SnapshotPage = () => {
  useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
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
  const [stagePalette, setStagePalette] = useState(DEFAULT_STAGE_PALETTE);
  const userId = effectiveUserId;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'milestone_stage_palette').maybeSingle();
      const saved = (data?.value ?? null) as Record<string, unknown> | null;
      if (!mounted || !saved || typeof saved !== 'object') return;
      setStagePalette({
        stage1: typeof saved.stage1 === 'string' ? saved.stage1 : DEFAULT_STAGE_PALETTE.stage1,
        stage2: typeof saved.stage2 === 'string' ? saved.stage2 : DEFAULT_STAGE_PALETTE.stage2,
        stage3: typeof saved.stage3 === 'string' ? saved.stage3 : DEFAULT_STAGE_PALETTE.stage3,
        stage4: typeof saved.stage4 === 'string' ? saved.stage4 : DEFAULT_STAGE_PALETTE.stage4,
      });
    })();
    return () => {
      mounted = false;
    };
  }, []);

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

  const gapCompletedCount = useMemo(() => gapPlans.filter(isGapPlanCompleted).length, [gapPlans]);
  const gapStatusRows = useMemo(() => {
    const counts = gapPlans.reduce((acc: Record<string, number>, plan) => {
      const status = plan.status || 'Not Set';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).sort((a, b) => (b[1] as number) - (a[1] as number));
  }, [gapPlans]);
  const gapPriorityRows = useMemo(() => {
    const counts = gapPlans.reduce((acc: Record<string, number>, plan) => {
      const priority = plan.priority || 'Not Set';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).sort((a, b) => (b[1] as number) - (a[1] as number));
  }, [gapPlans]);
  const highPriorityGapCount = useMemo(() => {
    return gapPlans.filter((p) => {
      const priority = String(p.priority || '');
      return (
        priority.includes('High Importance & High Urgency') ||
        priority.includes('High Importance & Low Urgency')
      );
    }).length;
  }, [gapPlans]);
  const simGapCompletedCount = useMemo(
    () => simulationGaps.filter(isSimulationGapCompleted).length,
    [simulationGaps]
  );
  const simGapStatusRows = useMemo(() => {
    const counts = simulationGaps.reduce((acc: Record<string, number>, g) => {
      const s = (g.status || 'identified') as string;
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts);
  }, [simulationGaps]);
  const simGapSeverityRows = useMemo(() => {
    const counts = simulationGaps.reduce((acc: Record<string, number>, g) => {
      const s = (g.severity || 'other') as string;
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts);
  }, [simulationGaps]);
  const recentActivities = useMemo(
    () =>
      [...activities]
        .sort((a, b) => activityTime(b.date) - activityTime(a.date))
        .slice(0, 8),
    [activities]
  );
  const totalActivityHours = useMemo(
    () => activities.reduce((sum: number, a: any) => sum + (Number(a.hours) || 0), 0),
    [activities]
  );
  const latestSavedScore = readinessScores.length > 0 ? readinessScores[readinessScores.length - 1] : null;
  const readinessAverage = useMemo(() => {
    if (!readinessScores.length) return null;
    return Math.round(readinessScores.reduce((sum, score) => sum + score.score, 0) / readinessScores.length);
  }, [readinessScores]);
  const readinessHighest = useMemo(() => {
    if (!readinessScores.length) return null;
    return Math.max(...readinessScores.map((s) => s.score));
  }, [readinessScores]);

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
      <Box
        sx={{
          bgcolor: 'background.default',
          minHeight: '70vh',
          py: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper elevation={0} sx={{ p: 4, maxWidth: 400, width: '100%', mx: 2, ...sectionShellSx }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Loading snapshot
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pulling checklist, gaps, activities, and readiness…
          </Typography>
          <LinearProgress sx={{ borderRadius: 1 }} />
        </Paper>
      </Box>
    );
  }

  if (hasError) {
    return (
      <Box
        sx={{
          bgcolor: 'background.default',
          minHeight: '70vh',
          py: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper elevation={0} sx={{ p: 4, maxWidth: 440, width: '100%', mx: 2, ...sectionShellSx, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom color="error" sx={{ fontWeight: 600 }}>
            Couldn&apos;t load snapshot
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Check your connection and try again.
          </Typography>
          <Button variant="contained" color="secondary" onClick={() => setRetryCount((c) => c + 1)} sx={{ mr: 1 }}>
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

  const gapCompletionPct =
    gapPlans.length > 0 ? Math.round((gapCompletedCount / gapPlans.length) * 100) : 0;

  const kpiItems = [
    ...(showPrsSection
      ? [
          {
            label: 'Latest saved score',
            value:
              latestSavedScore != null
                ? String(latestSavedScore.score)
                : currentPRSScore !== null
                  ? `${currentPRSScore}%`
                  : '—',
            caption:
              latestSavedScore != null
                ? scoreTrend !== 0
                  ? `${scoreTrend > 0 ? '+' : ''}${scoreTrend} since first`
                  : 'From Dashboard assessments'
                : currentPRSScore !== null
                  ? 'Live PRS (no saved scores yet)'
                  : 'No scores yet',
          },
          {
            label: 'Live PRS',
            value: currentPRSScore !== null ? `${currentPRSScore}%` : '—',
            caption: 'From current questionnaire',
          },
        ]
      : []),
    {
      label: 'Checklist',
      value: checklistMetrics.totalTasks > 0 ? checklistMetrics.kpiLabel : '—',
      caption:
        checklistMetrics.totalTasks > 0
          ? `${checklistMetrics.overallPct}% complete`
          : 'No tasks yet',
    },
    {
      label: 'Gap plans',
      value: String(gapPlans.length),
      caption:
        gapPlans.length > 0
          ? `${gapPlans.length - gapCompletedCount} open · ${gapCompletedCount} done`
          : 'None yet',
    },
    {
      label: 'Activities',
      value: String(activities.length),
      caption: activities.length > 0 ? `${totalActivityHours.toFixed(1)} hrs logged` : 'None yet',
    },
    {
      label: 'Sim gaps',
      value: String(simulationGaps.length),
      caption:
        simulationGaps.length > 0
          ? `${simulationGaps.length - simGapCompletedCount} open · ${simGapCompletedCount} done`
          : 'None yet',
    },
  ];

  return (
    <>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100%', pb: { xs: 4, md: 5 } }}>
        <Container
          maxWidth={false}
          sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, sm: 3, md: 4, lg: 5 }, width: '100%' }}
        >
          <Stack spacing={{ xs: 2, md: 2.5 }}>
            {/* Hero */}
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, md: 2.75 },
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                background: (t) =>
                  `linear-gradient(120deg, ${alpha(t.palette.secondary.main, 0.07)} 0%, ${t.palette.background.paper} 42%, ${alpha(t.palette.primary.main, 0.04)} 100%)`,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                <Box sx={{ maxWidth: { md: 640 } }}>
                  <Typography
                    variant="overline"
                    sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', mb: 0.5 }}
                  >
                    Site overview
                  </Typography>
                  <Typography
                    variant="h4"
                    component="h1"
                    sx={{
                      fontWeight: 700,
                      letterSpacing: -0.02,
                      mb: 0.75,
                      fontSize: { xs: '1.45rem', sm: '1.7rem', md: '1.85rem' },
                    }}
                  >
                    Snapshot
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6, fontSize: { xs: '0.925rem', sm: '0.975rem' } }}>
                    Summary of checklist, gaps, activities, simulations, and readiness for this site. Export a PDF to
                    share with leadership.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                  <Button size="small" variant="outlined" onClick={() => navigate('/milestones')}>
                    Checklist
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => navigate('/gap-plan')}>
                    Gap Plan
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => navigate('/activities')}>
                    Activities
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    size="small"
                    startIcon={<PictureAsPdfIcon />}
                    onClick={exportToComprehensivePDF}
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

            {/* At a glance */}
            <Paper elevation={0} sx={sectionShellSx}>
              <Box
                sx={{
                  px: { xs: 2, md: 2.5 },
                  py: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: alpha(theme.palette.secondary.main, 0.04),
                }}
              >
                <Typography
                  variant="overline"
                  sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
                >
                  At a glance
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  Live totals from Checklist, Gap Plan, Activities, and Simulation
                  {showPrsSection ? ', plus saved readiness scores' : ''}.
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    md: `repeat(${Math.min(kpiItems.length, 4)}, minmax(0, 1fr))`,
                    lg: `repeat(${kpiItems.length}, minmax(0, 1fr))`,
                  },
                  '& > *': {
                    borderRight: { xs: 'none', md: '1px solid' },
                    borderBottom: { xs: '1px solid', lg: 'none' },
                    borderColor: 'divider',
                  },
                  '& > *:nth-of-type(2n)': { borderRight: { xs: 'none' } },
                  '& > *:last-child': { borderRight: 'none', borderBottom: 'none' },
                }}
              >
                {kpiItems.map((item) => (
                  <Box key={item.label} sx={{ px: { xs: 1.75, md: 2 }, py: 1.75 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 600, letterSpacing: 0.04, textTransform: 'uppercase', fontSize: '0.65rem' }}
                    >
                      {item.label}
                    </Typography>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: '1.5rem',
                        letterSpacing: -0.02,
                        color: 'secondary.dark',
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1.15,
                        mt: 0.5,
                      }}
                    >
                      {item.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.35 }}>
                      {item.caption}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>

            {/* Checklist + Gap plans — CSS grid keeps edges aligned with full-width sections */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                gap: 2,
                width: '100%',
              }}
            >
              <Paper elevation={0} sx={{ ...sectionShellSx, height: '100%', minWidth: 0 }}>
                  <Box
                    sx={{
                      px: { xs: 2, md: 2.5 },
                      py: 1.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 1,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box>
                      <Typography
                        variant="overline"
                        sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
                      >
                        Checklist tab
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.015, fontSize: '1.1rem' }}>
                        Checklist progress
                      </Typography>
                    </Box>
                    <Button size="small" onClick={() => navigate('/milestones')}>
                      Open checklist
                    </Button>
                  </Box>
                  <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
                    {checklistMetrics.source === 'site_checklist' && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                        Using site checklist data (same as the Checklist tab).
                      </Typography>
                    )}
                    {checklistMetrics.totalTasks > 0 ? (
                      <>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Overall
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {checklistMetrics.completedTasks} of {checklistMetrics.totalTasks} · {checklistMetrics.overallPct}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={checklistMetrics.overallPct}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            mb: 2,
                            bgcolor: alpha(theme.palette.secondary.main, 0.12),
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 4,
                              bgcolor: 'secondary.main',
                            },
                          }}
                        />
                        {checklistMetrics.source === 'milestones_staged' && milestones[0]?.tasks != null && (
                          <Stack spacing={1.25}>
                            {milestones.map((stage: any, index: number) => {
                              const totalTasks = stage.tasks?.length || 0;
                              const completedTasks = stage.tasks?.filter((task: any) => task.completed)?.length || 0;
                              const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                              const barColor = resolveStageBarColor(stage, index, stagePalette);
                              return (
                                <Box key={stage.id}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.35 }}>
                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                      <Box
                                        sx={{
                                          width: 8,
                                          height: 8,
                                          borderRadius: '50%',
                                          bgcolor: barColor,
                                          flexShrink: 0,
                                        }}
                                        aria-hidden
                                      />
                                      <Typography variant="body2" sx={{ fontWeight: 600, color: barColor }}>
                                        {stage.title}
                                      </Typography>
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary">
                                      {completedTasks}/{totalTasks} · {progress}%
                                    </Typography>
                                  </Stack>
                                  <LinearProgress
                                    variant="determinate"
                                    value={progress}
                                    sx={{
                                      height: 6,
                                      borderRadius: 3,
                                      bgcolor: alpha(barColor, 0.15),
                                      '& .MuiLinearProgress-bar': {
                                        borderRadius: 3,
                                        bgcolor: barColor,
                                      },
                                    }}
                                  />
                                </Box>
                              );
                            })}
                          </Stack>
                        )}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No checklist progress recorded yet.
                      </Typography>
                    )}
                  </Box>
                </Paper>

              <Paper elevation={0} sx={{ ...sectionShellSx, height: '100%', minWidth: 0 }}>
                  <Box
                    sx={{
                      px: { xs: 2, md: 2.5 },
                      py: 1.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 1,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box>
                      <Typography
                        variant="overline"
                        sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
                      >
                        Gap Plan tab
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.015, fontSize: '1.1rem' }}>
                        Gap plans — status &amp; priority
                      </Typography>
                    </Box>
                    <Button size="small" onClick={() => navigate('/gap-plan')}>
                      Open gap plan
                    </Button>
                  </Box>
                  <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
                    {gapPlans.length > 0 ? (
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                          <Box
                            sx={{
                              p: 1.5,
                              borderRadius: 1.5,
                              bgcolor: alpha(theme.palette.secondary.main, 0.08),
                              border: '1px solid',
                              borderColor: 'divider',
                              textAlign: 'center',
                              height: '100%',
                            }}
                          >
                            <Typography sx={{ fontWeight: 700, fontSize: '1.75rem', color: 'secondary.dark', lineHeight: 1 }}>
                              {gapCompletionPct}%
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Completion · {gapCompletedCount}/{gapPlans.length}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                              {highPriorityGapCount} high priority
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.04 }}>
                            By status
                          </Typography>
                          <Stack spacing={0.75} sx={{ mt: 1 }}>
                            {gapStatusRows.map(([status, count]) => (
                              <Stack key={status as string} direction="row" justifyContent="space-between" spacing={1}>
                                <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                                  {status as string}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                  {count as number}
                                </Typography>
                              </Stack>
                            ))}
                          </Stack>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.04 }}>
                            By priority
                          </Typography>
                          <Stack spacing={0.75} sx={{ mt: 1 }}>
                            {gapPriorityRows.map(([priority, count]) => (
                              <Stack key={priority as string} direction="row" justifyContent="space-between" spacing={1}>
                                <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                                  {String(priority).replace(/\([^)]*\)/g, '').trim()}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                  {count as number}
                                </Typography>
                              </Stack>
                            ))}
                          </Stack>
                        </Grid>
                      </Grid>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No gap plans yet. Create them from the Gap Plan tab.
                      </Typography>
                    )}
                  </Box>
                </Paper>
            </Box>

            {/* Simulation */}
            <Paper elevation={0} sx={sectionShellSx}>
              <Box
                sx={{
                  px: { xs: 2, md: 2.5 },
                  py: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Box>
                  <Typography
                    variant="overline"
                    sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
                  >
                    Activities + Simulation tabs
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.015, fontSize: '1.1rem' }}>
                    Simulation activity &amp; gaps
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    Facilitation from Activities; gaps from the Simulation tab.
                  </Typography>
                </Box>
                <Button size="small" onClick={() => navigate('/simulation')}>
                  Open simulation
                </Button>
              </Box>
              <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Simulations by type
                    </Typography>
                    <SnapshotBarChart
                      data={simulationTypeData}
                      valueLabel="Simulations"
                      emptyMessage="No simulation activities recorded"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Participants by type
                    </Typography>
                    <SnapshotBarChart
                      data={simulationParticipantData}
                      valueLabel="Participants"
                      emptyMessage="No simulation activities recorded"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Gaps by status
                    </Typography>
                    {simulationGaps.length > 0 ? (
                      <Stack spacing={1}>
                        {simGapStatusRows.map(([status, count]) => {
                          const n = count as number;
                          const pct = Math.round((n / simulationGaps.length) * 100);
                          return (
                            <Box key={status as string}>
                              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.35 }}>
                                <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                  {String(status).replace(/_/g, ' ')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {n} ({pct}%)
                                </Typography>
                              </Stack>
                              <LinearProgress variant="determinate" value={pct} sx={{ height: 5, borderRadius: 3 }} />
                            </Box>
                          );
                        })}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No simulation gaps recorded.
                      </Typography>
                    )}
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Gaps by severity
                    </Typography>
                    {simulationGaps.length > 0 ? (
                      <Stack spacing={1}>
                        {simGapSeverityRows.map(([severity, count]) => {
                          const n = count as number;
                          const pct = Math.round((n / simulationGaps.length) * 100);
                          return (
                            <Box key={severity as string}>
                              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.35 }}>
                                <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                  {severity as string}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {n} ({pct}%)
                                </Typography>
                              </Stack>
                              <LinearProgress variant="determinate" value={pct} sx={{ height: 5, borderRadius: 3 }} />
                            </Box>
                          );
                        })}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No simulation gaps recorded.
                      </Typography>
                    )}
                  </Grid>
                </Grid>
              </Box>
            </Paper>

            {/* Activities */}
            <Paper elevation={0} sx={sectionShellSx}>
              <Box
                sx={{
                  px: { xs: 2, md: 2.5 },
                  py: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Box>
                  <Typography
                    variant="overline"
                    sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
                  >
                    Activities tab
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.015, fontSize: '1.1rem' }}>
                    Time, categories &amp; recent work
                  </Typography>
                </Box>
                <Button size="small" onClick={() => navigate('/activities')}>
                  Open activities
                </Button>
              </Box>
              <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{ mb: 2.5 }}
                  useFlexGap
                  flexWrap="wrap"
                >
                  {[
                    { label: 'This month', value: workHours.thisMonthHours },
                    { label: 'Last month', value: workHours.lastMonthHours },
                    { label: 'This year', value: workHours.thisYearHours },
                    { label: 'Total', value: workHours.totalHours },
                  ].map((tile) => (
                    <Box
                      key={tile.label}
                      sx={{
                        flex: '1 1 120px',
                        px: 1.5,
                        py: 1.25,
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: alpha(theme.palette.secondary.main, 0.04),
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.04 }}>
                        {tile.label}
                      </Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', color: 'secondary.dark', fontVariantNumeric: 'tabular-nums' }}>
                        {Number(tile.value).toFixed(1)}h
                      </Typography>
                    </Box>
                  ))}
                </Stack>

                <Grid container spacing={2} sx={{ mb: 2.5 }}>
                  <Grid item xs={12} lg={7}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      By category
                    </Typography>
                    {activityCategoryStats.length > 0 ? (
                      <SnapshotHorizontalBarChart
                        data={activityCategoryStats.map((row) => ({
                          label: row.label,
                          value: row.count,
                          sublabel: `${row.hours.toFixed(1)} hrs`,
                        }))}
                        valueLabel="Activities"
                        minHeight={260}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No activities recorded.
                      </Typography>
                    )}
                  </Grid>
                  <Grid item xs={12} lg={5}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Hours by category
                    </Typography>
                    {activityCategoryStats.length > 0 ? (
                      <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow
                              sx={{
                                '& th': {
                                  fontWeight: 600,
                                  fontSize: '0.7rem',
                                  textTransform: 'uppercase',
                                  color: 'text.secondary',
                                  bgcolor: alpha(theme.palette.primary.main, 0.03),
                                },
                              }}
                            >
                              <TableCell>Category</TableCell>
                              <TableCell align="right">#</TableCell>
                              <TableCell align="right">Hours</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {activityCategoryStats.map((row) => (
                              <TableRow key={row.label} hover>
                                <TableCell sx={{ fontSize: '0.8125rem' }}>{row.label}</TableCell>
                                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                  {row.count}
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                  {row.hours.toFixed(1)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No hours logged.
                      </Typography>
                    )}
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Recent activities
                </Typography>
                {recentActivities.length > 0 ? (
                  <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                    <Table size="small" aria-label="Recent activities">
                      <TableHead>
                        <TableRow
                          sx={{
                            '& th': {
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              textTransform: 'uppercase',
                              color: 'text.secondary',
                              bgcolor: alpha(theme.palette.primary.main, 0.03),
                            },
                          }}
                        >
                          <TableCell>Date</TableCell>
                          <TableCell>Activity</TableCell>
                          <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Categories</TableCell>
                          <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Entered by</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {recentActivities.map((a, idx) => (
                          <TableRow key={`${a.id || idx}`} hover>
                            <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.8125rem' }}>
                              {formatActivityDateLabel(a.date)}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                              {a.activity || a.title || 'Activity'}
                            </TableCell>
                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, fontSize: '0.8125rem', color: 'text.secondary' }}>
                              {displayActivityCategories(a)}
                            </TableCell>
                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, fontSize: '0.8125rem', color: 'text.secondary' }}>
                              {a.submitted_by
                                ? activitySubmitterById[a.submitted_by] || a.submitted_by
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No activities recorded.
                  </Typography>
                )}
              </Box>
            </Paper>

            {/* Pediatric readiness */}
            {showPrsSection && (
              <Paper elevation={0} sx={sectionShellSx}>
                <Box
                  sx={{
                    px: { xs: 2, md: 2.5 },
                    py: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography
                      variant="overline"
                      sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
                    >
                      Dashboard + PRS
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.015, fontSize: '1.1rem' }}>
                      Pediatric readiness
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      Saved assessment scores and live PRS from the questionnaire.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" onClick={() => navigate('/dashboard')}>
                      Dashboard scores
                    </Button>
                    {snapshotReadinessChartsVisible !== false ? (
                      <Button size="small" onClick={() => setReadinessChartsVisiblePref(false)}>
                        Hide charts
                      </Button>
                    ) : (
                      <Button size="small" onClick={() => setReadinessChartsVisiblePref(true)}>
                        Show charts
                      </Button>
                    )}
                  </Stack>
                </Box>

                {snapshotReadinessChartsVisible === false ? (
                  <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Readiness charts and assessment history are hidden.
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      useFlexGap
                      flexWrap="wrap"
                      sx={{ mb: 2 }}
                    >
                      {[
                        {
                          label: 'Latest saved',
                          value: latestSavedScore != null ? String(latestSavedScore.score) : '—',
                        },
                        { label: 'Average', value: readinessAverage != null ? String(readinessAverage) : '—' },
                        { label: 'Highest', value: readinessHighest != null ? String(readinessHighest) : '—' },
                        {
                          label: 'Live PRS',
                          value: currentPRSScore !== null ? `${currentPRSScore}%` : '—',
                        },
                      ].map((stat) => (
                        <Box
                          key={stat.label}
                          sx={{
                            flex: '1 1 110px',
                            px: 1.5,
                            py: 1.1,
                            borderRadius: 1.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: alpha(theme.palette.secondary.main, 0.04),
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.04 }}>
                            {stat.label}
                          </Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: 'secondary.dark', fontVariantNumeric: 'tabular-nums' }}>
                            {stat.value}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>

                    {readinessScores.length >= 2 && (
                      <Alert
                        severity={scoreTrend >= 0 ? 'success' : 'warning'}
                        variant="outlined"
                        icon={
                          scoreTrend > 0 ? (
                            <ArrowUpwardIcon fontSize="inherit" />
                          ) : scoreTrend < 0 ? (
                            <ArrowDownwardIcon fontSize="inherit" />
                          ) : (
                            <RemoveIcon fontSize="inherit" />
                          )
                        }
                        sx={{ mb: 2 }}
                      >
                        Change since first assessment:{' '}
                        <strong>
                          {scoreTrend > 0 ? '+' : ''}
                          {scoreTrend.toFixed(1)} pts
                        </strong>
                        {' · '}
                        {readinessScores.length} assessments · First{' '}
                        {format(new Date(readinessScores[0]?.date || new Date()), 'MMM d, yyyy')} · Latest{' '}
                        {format(
                          new Date(readinessScores[readinessScores.length - 1]?.date || new Date()),
                          'MMM d, yyyy'
                        )}
                      </Alert>
                    )}

                    <PeccReadinessTrendChart scores={readinessScores} liveScore={currentPRSScore} height={360} />

                    {readinessScores.length > 0 && (
                      <Box sx={{ mt: 2.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                          Assessment history
                        </Typography>
                        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow
                                sx={{
                                  '& th': {
                                    fontWeight: 600,
                                    fontSize: '0.7rem',
                                    textTransform: 'uppercase',
                                    color: 'text.secondary',
                                    bgcolor: alpha(theme.palette.primary.main, 0.03),
                                  },
                                }}
                              >
                                <TableCell>#</TableCell>
                                <TableCell>Date</TableCell>
                                <TableCell align="right">Score</TableCell>
                                <TableCell align="right">Change</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {[...readinessScores]
                                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                .map((score, index, sorted) => {
                                  const delta = index > 0 ? score.score - sorted[index - 1].score : null;
                                  return (
                                    <TableRow key={score.id || `${score.date}-${index}`} hover>
                                      <TableCell>{index + 1}</TableCell>
                                      <TableCell sx={{ color: 'text.secondary' }}>
                                        {formatActivityDateLabel(score.date)}
                                      </TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 700, color: 'secondary.dark', fontVariantNumeric: 'tabular-nums' }}>
                                        {score.score}
                                      </TableCell>
                                      <TableCell
                                        align="right"
                                        sx={{
                                          fontVariantNumeric: 'tabular-nums',
                                          color:
                                            delta == null
                                              ? 'text.secondary'
                                              : delta > 0
                                                ? 'success.main'
                                                : delta < 0
                                                  ? 'error.main'
                                                  : 'text.secondary',
                                          fontWeight: 600,
                                        }}
                                      >
                                        {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}

                    {domainScores && (
                      <Box sx={{ mt: 3 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                          PRS by domain
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                          From your current PRS questionnaire answers.
                        </Typography>
                        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, mb: 2 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow
                                sx={{
                                  '& th': {
                                    fontWeight: 600,
                                    fontSize: '0.7rem',
                                    textTransform: 'uppercase',
                                    color: 'text.secondary',
                                    bgcolor: alpha(theme.palette.primary.main, 0.03),
                                  },
                                }}
                              >
                                <TableCell>Domain</TableCell>
                                <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                  Points
                                </TableCell>
                                <TableCell align="right">%</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {Object.entries(domainScores).map(([domain, data]) => (
                                <TableRow key={domain} hover>
                                  <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{domain}</TableCell>
                                  <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' }, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                                    {data.earned.toFixed(1)} / {data.total}
                                  </TableCell>
                                  <TableCell align="right" sx={{ minWidth: 140 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                                      <LinearProgress
                                        variant="determinate"
                                        value={data.percentage}
                                        sx={{ width: 72, height: 6, borderRadius: 3, display: { xs: 'none', md: 'block' } }}
                                      />
                                      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'right' }}>
                                        {data.percentage}%
                                      </Typography>
                                    </Stack>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        <SnapshotHorizontalBarChart data={domainBarData} valueLabel="%" minHeight={280} />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                          ≥80% strong · 60–79% fair · &lt;60% needs focus
                        </Typography>
                      </Box>
                    )}

                    {!domainScores && readinessScores.length === 0 && (
                      <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
                        Add readiness scores on the Dashboard, or complete the PRS questionnaire, to populate this
                        section.
                      </Alert>
                    )}
                  </Box>
                )}
              </Paper>
            )}
          </Stack>
        </Container>
      </Box>

      <Snackbar
        open={pdfSnackbar.open}
        autoHideDuration={6000}
        onClose={() => setPdfSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={pdfSnackbar.severity}
          onClose={() => setPdfSnackbar((s) => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {pdfSnackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default SnapshotPage;

