import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  LinearProgress,
  Button
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WorkIcon from '@mui/icons-material/Work';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SlideshowIcon from '@mui/icons-material/Slideshow';

// Type definitions for PRS questions
interface PRSQuestion {
  id: string;
  text: string;
  type: 'yesno' | 'radio' | 'checkbox' | 'text' | 'numeric' | 'paragraph' | 'subquestions' | 'header';
  options?: string[];
  subQuestions?: PRSQuestion[];
  answer?: string | string[] | null;
  points?: number;
}

const SnapshotPage = () => {
  const { currentUser } = useAuth();
  
  const [activities, setActivities] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [gapPlans, setGapPlans] = useState<any[]>([]);
  const [readinessScores, setReadinessScores] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [renderError, setRenderError] = useState(false);

  const exportToPDF = () => {
    // Create a simple PDF export using window.print() for now
    // In a production app, you'd use a library like jsPDF or html2pdf
    window.print();
  };

  // Load all data for snapshot
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        console.log('SnapshotPage: Loading data from localStorage...');
        
        // Load activities (try both user-specific and generic keys)
        let savedActivities = null;
        if (currentUser?.uid) {
          savedActivities = localStorage.getItem(`activities_${currentUser.uid}`);
        }
        if (!savedActivities) {
          savedActivities = localStorage.getItem('activities');
        }
        if (savedActivities) {
          setActivities(JSON.parse(savedActivities));
        }

        // Load milestones (try both user-specific and generic keys)
        let savedMilestones = null;
        if (currentUser?.uid) {
          savedMilestones = localStorage.getItem(`milestones_${currentUser.uid}`);
        }
        if (!savedMilestones) {
          savedMilestones = localStorage.getItem('milestones');
        }
        if (savedMilestones) {
          setMilestones(JSON.parse(savedMilestones));
        }

        // Load gap plans (try both user-specific and generic keys)
        let savedGapPlans = null;
        if (currentUser?.uid) {
          savedGapPlans = localStorage.getItem(`gapPlans_${currentUser.uid}`);
        }
        if (!savedGapPlans) {
          savedGapPlans = localStorage.getItem(`gapPlans`);
        }
        if (!savedGapPlans) {
          savedGapPlans = localStorage.getItem(`prsGapPlans`);
        }
        if (savedGapPlans) {
          setGapPlans(JSON.parse(savedGapPlans));
        }

        // Load readiness scores (try both user-specific and generic keys)
        let savedScores = null;
        if (currentUser?.uid) {
          savedScores = localStorage.getItem(`readinessScores_${currentUser.uid}`);
        }
        if (!savedScores) {
          savedScores = localStorage.getItem('readinessScores');
        }
        if (!savedScores) {
          savedScores = localStorage.getItem('prsReadinessScores');
        }
        if (savedScores) {
          setReadinessScores(JSON.parse(savedScores));
        }

        // Log the loaded data using the parsed values
        const loadedActivities = savedActivities ? JSON.parse(savedActivities) : [];
        const loadedMilestones = savedMilestones ? JSON.parse(savedMilestones) : [];
        const loadedGapPlans = savedGapPlans ? JSON.parse(savedGapPlans) : [];
        const loadedScores = savedScores ? JSON.parse(savedScores) : [];
        
        console.log('SnapshotPage: Data loaded:', {
          activities: loadedActivities.length,
          milestones: loadedMilestones.length,
          gapPlans: loadedGapPlans.length,
          readinessScores: loadedScores.length
        });
        
      } catch (err) {
        console.error('Error loading snapshot data:', err);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentUser?.uid]);

  const exportToComprehensivePDF = () => {
    try {
      // Create a comprehensive PDF that captures ALL visual elements from the Snapshot page
      const createComprehensiveReport = () => {
        // Check if jsPDF is available
        let jsPDF;
        try {
          jsPDF = require('jspdf');
        } catch (e) {
          console.error('jsPDF library not available:', e);
          alert('PDF export library not available. Please contact support.');
          return null;
        }
        
        const doc = new jsPDF();
        
        // Set up styling
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const titleY = 30;
        const sectionY = 50;
        const lineHeight = 12;
        
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
          doc.setFont(undefined, 'bold');
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
          doc.setFont(undefined, 'bold');
          doc.setTextColor(33, 37, 41);
          doc.text(value, x + 5, y + 12);
          
          // Add label
          doc.setFontSize(11);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(33, 37, 41);
          doc.text(label, x + 5, y + 22);
          
          // Add wrapped description
          doc.setFontSize(9);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(108, 117, 125);
          addWrappedText(description, x + 5, y + 30, width - 10, 9);
          
          return y + 40;
        };
        
        // Helper function to add progress bars (like the progress indicators)
        const addProgressBar = (label: string, percentage: number, y: number, description?: string) => {
          doc.setFontSize(11);
          doc.setFont(undefined, 'bold');
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
          doc.setFont(undefined, 'bold');
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
        
        // Page 1: Executive Summary & Key Performance Indicators
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(33, 150, 243);
        doc.text('Pediatric Readiness', pageWidth / 2, titleY, { align: 'center' });
        doc.text('Comprehensive Snapshot Report', pageWidth / 2, titleY + 15, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(108, 117, 125);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, titleY + 35, { align: 'center' });
        
        // Key Performance Indicators Section (like the KPI cards on the page)
        let currentY = addSectionHeader('Key Performance Indicators (KPIs) - Most Critical Metrics', sectionY + 40);
        
        // Calculate metrics exactly like the page does
        const currentScore = readinessScores.length > 0 ? readinessScores[readinessScores.length - 1]?.score || 0 : 0;
        const completedItems = milestones.filter(m => m.status === 'completed').length;
        const totalItems = milestones.length;
        const completionRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
        const completedGapPlans = gapPlans.filter(p => p.status === 'Completed').length;
        const totalGapPlans = gapPlans.length;
        const gapCompletionRate = totalGapPlans > 0 ? Math.round((completedGapPlans / totalGapPlans) * 100) : 0;
        
        // Add KPI metric boxes in a grid (like the page layout) - scaled to fit
        const boxWidth = Math.min(45, (pageWidth - margin * 2 - 30) / 4); // Ensure 4 boxes fit
        const spacing = (pageWidth - margin * 2 - boxWidth * 4) / 3;
        
        addMetricBox('Current Score', currentScore.toString(), 'Latest readiness assessment score', margin, currentY, boxWidth);
        addMetricBox('Completion Rate', `${completionRate}%`, 'Checklist items completed', margin + boxWidth + spacing, currentY, boxWidth);
        addMetricBox('Gap Plans', `${completedGapPlans}/${totalGapPlans}`, 'Completed vs. total gap plans', margin + (boxWidth + spacing) * 2, currentY, boxWidth);
        addMetricBox('Activities', activities.length.toString(), 'Total activities logged', margin + (boxWidth + spacing) * 3, currentY, boxWidth);
        
        currentY += 50;
        
        // Progress Bars (like the progress indicators on the page)
        currentY = addProgressBar('Checklist Progress', completionRate, currentY, 'Overall completion rate of all checklist items across all stages');
        currentY = addProgressBar('Gap Plan Completion', gapCompletionRate, currentY, 'Percentage of gap plans that have been completed');
        
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
          if (milestone.status === 'completed') {
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
        
        // Page 3: Activity Summary & Trends (like the "Activity Category Distribution" section)
        doc.addPage();
        currentY = titleY;
        
        currentY = addSectionHeader('Activity Summary & Trends', currentY);
        
        // Activity Category Distribution (like the chart on the page)
        currentY = addSectionHeader('Activity Category Distribution', currentY + 10);
        
        const activityCategories = activities.reduce((acc, activity) => {
          acc[activity.category] = (acc[activity.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        // Create chart data for activity categories
        const chartData = Object.entries(activityCategories).map(([category, count]) => ({
          label: category,
          value: count as number,
          color: '#4CAF50' // Green
        }));
        
        currentY = addChartSection('Activity Distribution by Category', chartData, currentY);
        
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
              const activityDate = new Date(a.date);
              return activityDate.getMonth() === currentMonth && 
                     activityDate.getFullYear() === currentYear;
            })
            .reduce((sum, a) => sum + (a.hours || 0), 0);
          
          const lastMonthHours = activities
            .filter(a => {
              const activityDate = new Date(a.date);
              const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
              const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
              return activityDate.getMonth() === lastMonth && 
                     activityDate.getFullYear() === lastMonthYear;
            })
            .reduce((sum, a) => sum + (a.hours || 0), 0);
          
          const thisYearHours = activities
            .filter(a => {
              const activityDate = new Date(a.date);
              return activityDate.getFullYear() === currentYear;
            })
            .reduce((sum, a) => sum + (a.hours || 0), 0);
          
          const totalHours = activities.reduce((sum, a) => sum + (a.hours || 0), 0);
          
          // Add hour metrics
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(33, 37, 41);
          doc.text('This Month:', margin, currentY);
          doc.setFontSize(11);
          doc.setFont(undefined, 'normal');
          doc.text(`${thisMonthHours} hours`, margin + 80, currentY);
          currentY += 15;
          
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.text('Last Month:', margin, currentY);
          doc.setFontSize(11);
          doc.setFont(undefined, 'normal');
          doc.text(`${lastMonthHours} hours`, margin + 80, currentY);
          currentY += 15;
          
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.text('This Year:', margin, currentY);
          doc.setFontSize(11);
          doc.setFont(undefined, 'normal');
          doc.text(`${thisYearHours} hours`, margin + 80, currentY);
          currentY += 15;
          
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.text('Total Hours:', margin, currentY);
          doc.setFontSize(11);
          doc.setFont(undefined, 'normal');
          doc.text(`${totalHours} hours`, margin + 80, currentY);
          currentY += 20;
        }
        
        // Recent Activities (like the recent activities section)
        currentY += 10;
        currentY = addSectionHeader('Recent Activities', currentY);
        
        const recentActivities = activities.slice(-10); // Last 10 activities
        recentActivities.forEach((activity, index) => {
          if (currentY < pageHeight - margin) {
            doc.setFontSize(10);
            doc.setTextColor(33, 37, 41);
            doc.text(`${index + 1}. ${activity.title}`, margin, currentY);
            doc.setFontSize(9);
            doc.setTextColor(108, 117, 125);
            
            // Wrap activity details to fit page width
            const detailsText = `${activity.date} - ${activity.category}`;
            const detailsY = addWrappedText(detailsText, margin + 10, currentY + 5, pageWidth - margin * 2 - 10, 9);
            currentY = detailsY + 5;
          }
        });
        
        // Page 4: Simulation Analytics & Participant Data
        if (activities.filter(a => a.category === 'Simulation Facilitation').length > 0) {
          doc.addPage();
          currentY = titleY;
          
          currentY = addSectionHeader('Simulation Analytics & Participant Data', currentY);
          
          // Simulations by Type (like the simulation type chart on the page)
          currentY = addSectionHeader('Simulations by Type', currentY + 10);
          
          const simulationTypes = Array.from(new Set(activities
            .filter(a => a.category === 'Simulation Facilitation')
            .map(a => a.simulation || 'Other')));
          
          if (simulationTypes.length > 0) {
            const simTypeData = simulationTypes.map(simType => {
              const count = activities.filter(a => 
                a.category === 'Simulation Facilitation' && 
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
                a.category === 'Simulation Facilitation' && 
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
                a.category === 'Simulation Facilitation' && 
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
        
        // Page 5: Readiness Score Trends & Analysis (like the readiness score sections)
        if (readinessScores.length > 0) {
          doc.addPage();
          currentY = titleY;
          
          currentY = addSectionHeader('Readiness Score Trends & Analysis', currentY);
          
          // Score progression with visual indicators (like the score trends on the page)
          readinessScores.forEach((score, index) => {
            if (currentY < pageHeight - margin) {
              doc.setFontSize(11);
              doc.setFont(undefined, 'bold');
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
            doc.setFont(undefined, 'bold');
            doc.setTextColor(33, 37, 41);
            doc.text('Improvement Summary:', margin, currentY);
            currentY += 15;
            
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
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
            doc.setFont(undefined, 'bold');
            doc.setTextColor(33, 37, 41);
            doc.text(`${priority} Priority:`, margin, currentY);
            currentY += 10;
            
            const statusEntries = statuses as Record<string, number>;
            Object.entries(statusEntries).forEach(([status, count]) => {
              doc.setFontSize(9);
              doc.setFont(undefined, 'normal');
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
        
        // Activity Category Distribution with Hours (like the detailed breakdown on the page)
        currentY = addSectionHeader('Activity Category Distribution with Hours', currentY + 10);
        
        if (activities.length > 0) {
          const categoryStats = activities.reduce((acc, activity) => {
            const category = activity.category;
            if (!acc[category]) {
              acc[category] = { count: 0, hours: 0 };
            }
            acc[category].count += 1;
            acc[category].hours += activity.hours || 0;
            return acc;
          }, {} as Record<string, { count: number; hours: number }>);
          
          const sortedCategories = Object.entries(categoryStats)
            .sort(([, a], [, b]) => (b as { hours: number }).hours - (a as { hours: number }).hours);
          
          sortedCategories.forEach(([category, stats]) => {
            if (currentY < pageHeight - margin) {
              doc.setFontSize(11);
              doc.setFont(undefined, 'bold');
              doc.setTextColor(33, 37, 41);
              doc.text(category, margin, currentY);
              doc.setFontSize(10);
              doc.setFont(undefined, 'normal');
              doc.setTextColor(108, 117, 125);
              doc.text(`Activities: ${(stats as { count: number }).count}`, margin + 80, currentY);
              doc.text(`Hours: ${(stats as { hours: number }).hours}`, margin + 150, currentY);
              currentY += 15;
            }
          });
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
        if (readinessScores.length < 2) {
          recommendations.push('Complete additional readiness assessments to establish baseline, track progress, and identify trends');
        }
        if (totalGapPlans === 0) {
          recommendations.push('Develop gap plans based on assessment results to create actionable improvement strategies');
        }
        
        if (recommendations.length === 0) {
          recommendations.push('Excellent progress! Continue maintaining current momentum and consider mentoring others in your organization');
          recommendations.push('Focus on sustainability and long-term maintenance of pediatric readiness standards');
        }
        
        // Add specific recommendations based on data patterns
        if (readinessScores.length > 1) {
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
      
      // Create and download the PDF
      const doc = createComprehensiveReport();
      doc.save(`PECC_Comprehensive_Snapshot_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      
      // Show success message
      alert('Comprehensive Snapshot PDF Report downloaded! This report captures ALL the visual elements, charts, graphs, and metrics from your Snapshot page in a beautiful, professional format with proper text wrapping and scaling.');
      
    } catch (error) {
      console.error('Error creating comprehensive snapshot report:', error);
      alert('Error creating report. Please try again.');
    }
  };


  // Show loading state
  if (isLoading) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Loading Snapshot...
        </Typography>
        <LinearProgress sx={{ width: '50%', mx: 'auto', mt: 2 }} />
      </Box>
    );
  }

  // Show error state
  if (hasError) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom color="error">
          Error Loading Snapshot
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          There was an error loading your snapshot data. Please try refreshing the page.
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => window.location.reload()}
        >
          Refresh Page
        </Button>
      </Box>
    );
  }

    try {
    return (
      <Box sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h3" gutterBottom color="primary">
                Snapshot
              </Typography>
              <Typography variant="h6" gutterBottom sx={{ mb: 4, color: 'text.secondary' }}>
                Comprehensive overview of your pediatric readiness progress and performance metrics
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<PictureAsPdfIcon />}
              onClick={exportToComprehensivePDF}
              sx={{ bgcolor: 'error.main', '&:hover': { bgcolor: 'error.dark' } }}
            >
              Export to PDF
            </Button>
          </Box>

      {/* Key Performance Indicators (KPIs) - Most Critical Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <TrendingUpIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" color="primary">
                {readinessScores.length > 0 ? readinessScores[readinessScores.length - 1]?.score || 'N/A' : 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Current Readiness Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h4" color="success.main">
                {milestones.filter(m => m.status === 'completed').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed Checklist Items
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AssessmentIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
              <Typography variant="h4" color="warning.main">
                {gapPlans.filter(p => p.status === 'Completed').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed Gap Plans
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <WorkIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h4" color="info.main">
                {activities.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Activities
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Overall Progress Overview - High-Level Progress Tracking */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Overall Checklist Progress
              </Typography>
              <Box sx={{ mt: 2 }}>
                {milestones.length > 0 ? (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Overall Progress</Typography>
                      <Typography variant="body2">
                        {Math.round((milestones.filter(m => m.status === 'completed').length / milestones.length) * 100)}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={(milestones.filter(m => m.status === 'completed').length / milestones.length) * 100}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        {milestones.filter(m => m.status === 'completed').length} of {milestones.length} completed
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No checklist data available
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
                Gap Plan Completion Overview
              </Typography>
              <Box sx={{ mt: 2 }}>
                {gapPlans.length > 0 ? (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">In Progress</Typography>
                      <Typography variant="body2">
                        {gapPlans.filter(p => p.status === 'In Progress').length}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Completed</Typography>
                      <Typography variant="body2">
                        {gapPlans.filter(p => p.status === 'Completed').length}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Needs Update</Typography>
                      <Typography variant="body2">
                        {gapPlans.filter(p => p.status === 'Needs Update').length}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Need to Develop</Typography>
                      <Typography variant="body2">
                        {gapPlans.filter(p => p.status === 'Need to Develop').length}
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
      </Grid>

      {/* Readiness Assessment Progress - Core Mission Metrics */}
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
                        {(() => {
                          try {
                            const prsQuestions = localStorage.getItem('prsQuestions');
                            if (prsQuestions) {
                              const questions = JSON.parse(prsQuestions);
                              
                              // Use the same scoring logic as the PRS page
                              let totalPoints = 0;
                              let earnedPoints = 0;

                              const calculateQuestionPoints = (question: PRSQuestion): number => {
                                if (question.points) {
                                  totalPoints += question.points;
                                  
                                  // Check if the question has a valid answer that should earn points
                                  if (question.answer) {
                                    let shouldEarnPoints = false;
                                    
                                    // For yes/no questions, only 'yes' earns points
                                    if (question.type === 'yesno') {
                                      shouldEarnPoints = question.answer === 'yes';
                                    }
                                    // For radio questions, any selected option earns points
                                    else if (question.type === 'radio') {
                                      shouldEarnPoints = true;
                                    }
                                    // For checkbox questions, any selected options earn points
                                    else if (question.type === 'checkbox') {
                                      shouldEarnPoints = Array.isArray(question.answer) && question.answer.length > 0;
                                    }
                                    // For text/numeric questions, any non-empty answer earns points
                                    else if (question.type === 'text' || question.type === 'numeric' || question.type === 'paragraph') {
                                      shouldEarnPoints = question.answer !== '' && question.answer !== null;
                                    }
                                    // For other types, any answer earns points
                                    else {
                                      shouldEarnPoints = true;
                                    }
                                    
                                    if (shouldEarnPoints) {
                                      earnedPoints += question.points;
                                    }
                                  }
                                }

                                if (question.subQuestions) {
                                  question.subQuestions.forEach((subQ: any) => {
                                    calculateQuestionPoints(subQ);
                                  });
                                }

                                return earnedPoints;
                              };

                              questions.forEach((question: PRSQuestion) => {
                                calculateQuestionPoints(question);
                              });

                              if (totalPoints > 0) {
                                const score = Math.round((earnedPoints / totalPoints) * 100);
                                return score + '%';
                              }
                            }
                            return 'N/A';
                          } catch (error) {
                            return 'N/A';
                          }
                        })()}
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

      {/* Readiness Score Chart - Full Width Line Chart */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Readiness Score Progress Chart
              </Typography>
              
              {/* Trend Metrics Section */}
              {readinessScores.length > 0 && (
                <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Trend Analysis
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
                          {readinessScores[readinessScores.length - 1]?.score || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Latest Score
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          {Math.round(readinessScores.reduce((sum, score) => sum + score.score, 0) / readinessScores.length)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Average Score
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" color="success.main" sx={{ fontWeight: 'bold' }}>
                          {Math.max(...readinessScores.map(s => s.score))}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Highest Score
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" color="warning.main" sx={{ fontWeight: 'bold' }}>
                          {(() => {
                            try {
                              const prsQuestions = localStorage.getItem('prsQuestions');
                              if (prsQuestions) {
                                const questions = JSON.parse(prsQuestions);
                                
                                // Use the same scoring logic as the PRS page
                                let totalPoints = 0;
                                let earnedPoints = 0;

                                const calculateQuestionPoints = (question: PRSQuestion): number => {
                                  if (question.points) {
                                    totalPoints += question.points;
                                    
                                    // Check if the question has a valid answer that should earn points
                                    if (question.answer) {
                                      let shouldEarnPoints = false;
                                      
                                      // For yes/no questions, only 'yes' earns points
                                      if (question.type === 'yesno') {
                                        shouldEarnPoints = question.answer === 'yes';
                                      }
                                      // For radio questions, any selected option earns points
                                      else if (question.type === 'radio') {
                                        shouldEarnPoints = true;
                                      }
                                      // For checkbox questions, any selected options earn points
                                      else if (question.type === 'checkbox') {
                                        shouldEarnPoints = Array.isArray(question.answer) && question.answer.length > 0;
                                      }
                                      // For text/numeric questions, any non-empty answer earns points
                                      else if (question.type === 'text' || question.type === 'numeric' || question.type === 'paragraph') {
                                        shouldEarnPoints = question.answer !== '' && question.answer !== null;
                                      }
                                      // For other types, any answer earns points
                                      else {
                                        shouldEarnPoints = true;
                                      }
                                      
                                      if (shouldEarnPoints) {
                                        earnedPoints += question.points;
                                      }
                                    }
                                  }

                                  if (question.subQuestions) {
                                    question.subQuestions.forEach((subQ: any) => {
                                      calculateQuestionPoints(subQ);
                                    });
                                  }

                                  return earnedPoints;
                                };

                                questions.forEach((question: PRSQuestion) => {
                                  calculateQuestionPoints(question);
                                });

                                if (totalPoints > 0) {
                                  const score = Math.round((earnedPoints / totalPoints) * 100);
                                  return score;
                                }
                              }
                              return 'N/A';
                            } catch (error) {
                              return 'N/A';
                            }
                          })()}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Current Live PRS
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  
                  {/* Progress Trend Summary */}
                  {readinessScores.length >= 2 && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="primary.main" sx={{ fontWeight: 'bold' }}>
                            Progress Trend: {(() => {
                              const firstScore = readinessScores[0].score;
                              const lastScore = readinessScores[readinessScores.length - 1].score;
                              const improvement = lastScore - firstScore;
                              if (improvement > 0) return `+${improvement.toFixed(1)} points improvement`;
                              if (improvement < 0) return `${improvement.toFixed(1)} points decline`;
                              return 'No change';
                            })()}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="primary.main" sx={{ fontWeight: 'bold' }}>
                            Total Assessments: {readinessScores.length}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  )}
                </Box>
              )}
              
              <Box sx={{ mt: 2, height: 400, position: 'relative' }}>
                {readinessScores.length > 0 ? (
                  <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                    {/* Chart Container */}
                    <Box sx={{ 
                      width: '100%', 
                      height: '100%', 
                      position: 'relative',
                      p: 2
                    }}>
                      {/* Y-axis labels */}
                      <Box sx={{ 
                        position: 'absolute', 
                        left: 0, 
                        top: 0, 
                        bottom: 0, 
                        width: 40,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        pr: 1
                      }}>
                        {[100, 80, 60, 40, 20, 0].map((value) => (
                          <Typography key={value} variant="caption" color="text.secondary">
                            {value}%
                          </Typography>
                        ))}
                      </Box>
                      
                      {/* Chart Area */}
                      <Box sx={{ 
                        position: 'absolute', 
                        left: 40, 
                        top: 0, 
                        right: 0, 
                        bottom: 0,
                        borderLeft: '1px solid #e0e0e0',
                        borderBottom: '1px solid #e0e0e0'
                      }}>
                        {/* Grid Lines are now rendered inside the SVG for proper layering */}
                        
                        {/* Data Points and Lines */}
                        {(() => {
                          // Prepare chart data including today's live PRS score
                          const chartData = [...readinessScores];
                          
                          // Add today's live PRS score if we have current data
                          const today = new Date().toISOString().split('T')[0];
                          const hasTodayData = chartData.some(score => score.date === today);
                          
                          if (!hasTodayData) {
                            // Get current PRS score from localStorage using proper scoring logic
                            let currentPRSScore = null;
                            try {
                              const prsQuestions = localStorage.getItem('prsQuestions');
                              if (prsQuestions) {
                                const questions = JSON.parse(prsQuestions);
                                
                                // Use the same scoring logic as the PRS page
                                let totalPoints = 0;
                                let earnedPoints = 0;

                                const calculateQuestionPoints = (question: PRSQuestion): number => {
                                  if (question.points) {
                                    totalPoints += question.points;
                                    
                                    // Check if the question has a valid answer that should earn points
                                    if (question.answer) {
                                      let shouldEarnPoints = false;
                                      
                                      // For yes/no questions, only 'yes' earns points
                                      if (question.type === 'yesno') {
                                        shouldEarnPoints = question.answer === 'yes';
                                      }
                                      // For radio questions, any selected option earns points
                                      else if (question.type === 'radio') {
                                        shouldEarnPoints = true;
                                      }
                                      // For checkbox questions, any selected options earn points
                                      else if (question.type === 'checkbox') {
                                        shouldEarnPoints = Array.isArray(question.answer) && question.answer.length > 0;
                                      }
                                      // For text/numeric questions, any non-empty answer earns points
                                      else if (question.type === 'text' || question.type === 'numeric' || question.type === 'paragraph') {
                                        shouldEarnPoints = question.answer !== '' && question.answer !== null;
                                      }
                                      // For other types, any answer earns points
                                      else {
                                        shouldEarnPoints = true;
                                      }
                                      
                                      if (shouldEarnPoints) {
                                        earnedPoints += question.points;
                                      }
                                    }
                                  }

                                  if (question.subQuestions) {
                                    question.subQuestions.forEach((subQ: any) => {
                                      calculateQuestionPoints(subQ);
                                    });
                                  }

                                  return earnedPoints;
                                };

                                questions.forEach((question: PRSQuestion) => {
                                  calculateQuestionPoints(question);
                                });

                                if (totalPoints > 0) {
                                  currentPRSScore = Math.round((earnedPoints / totalPoints) * 100);
                                }
                              }
                            } catch (error) {
                              console.log('Could not load current PRS score');
                            }
                            
                            if (currentPRSScore !== null) {
                              chartData.push({
                                id: 'live-prs',
                                date: today,
                                score: currentPRSScore,
                                isLive: true
                              });
                            }
                          }
                          
                          // Sort by date
                          const sortedData = chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                          
                          if (sortedData.length < 2) return null;
                          
                          const chartWidth = 800; // Fixed width for calculations
                          const chartHeight = 300;
                          const padding = 40;
                          const availableWidth = chartWidth - (padding * 2);
                          const availableHeight = chartHeight - (padding * 2);
                          
                          // Calculate scales
                          const minScore = Math.min(...sortedData.map(d => d.score));
                          const maxScore = Math.max(...sortedData.map(d => d.score));
                          // Use a fixed range from 0 to 100 for consistent Y-axis scaling
                          const scoreRange = 100;
                          
                          const xScale = (index: number) => {
                            // Make all points equidistant regardless of actual dates
                            return padding + (index / (sortedData.length - 1)) * availableWidth;
                          };
                          
                          const yScale = (score: number) => {
                            // Y-axis: 0% at bottom, 100% at top
                            return padding + ((100 - score) / scoreRange) * availableHeight;
                          };
                          
                          // Draw lines
                          const points = sortedData.map((d, index) => ({
                            x: xScale(index),
                            y: yScale(d.score),
                            score: d.score,
                            date: d.date,
                            isLive: d.isLive
                          }));
                          
                          // Create SVG path for the line
                          const linePath = points.map((point, index) => 
                            `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
                          ).join(' ');
                          
                          return (
                            <svg
                              width="100%"
                              height="100%"
                              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                              style={{ maxWidth: '100%', height: 'auto' }}
                            >
                              {/* Grid Lines - Render first (background) */}
                              {[100, 80, 60, 40, 20, 0].map((value) => {
                                const y = padding + ((100 - value) / 100) * availableHeight;
                                return (
                                  <line
                                    key={value}
                                    x1={padding}
                                    y1={y}
                                    x2={chartWidth - padding}
                                    y2={y}
                                    stroke="#f0f0f0"
                                    strokeWidth="1"
                                  />
                                );
                              })}
                              
                              {/* Line connecting points */}
                              <path
                                d={linePath}
                                stroke="#1976d2"
                                strokeWidth="3"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              
                              {/* Data points and labels - Render last (foreground) */}
                              {points.map((point, index) => (
                                <g key={index}>
                                  {/* Point circle */}
                                  <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={point.isLive ? "6" : "4"}
                                    fill={point.isLive ? "#ff6b35" : "#1976d2"}
                                    stroke="white"
                                    strokeWidth="2"
                                  />
                                  
                                  {/* Score label */}
                                  <text
                                    x={point.x}
                                    y={point.y - 15}
                                    textAnchor="middle"
                                    fontSize="12"
                                    fill={point.isLive ? "#ff6b35" : "#1976d2"}
                                    fontWeight="bold"
                                  >
                                    {point.score}%
                                  </text>
                                  
                                  {/* Date label */}
                                  <text
                                    x={point.x}
                                    y={point.y + 25}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="#666"
                                  >
                                    {point.isLive ? 'Live PRS' : new Date(point.date).toLocaleDateString()}
                                  </text>
                                </g>
                              ))}
                            </svg>
                          );
                        })()}
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                    No readiness scores available to display chart
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Readiness Score Progress Over Time - Detailed List View */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Readiness Score Progress Over Time
              </Typography>
              <Box sx={{ mt: 2 }}>
                {readinessScores.length > 0 ? (
                  <>
                    <Box sx={{ mb: 3 }}>
                      {readinessScores
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((score, index) => (
                          <Box key={score.id} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                Assessment #{index + 1}
                              </Typography>
                              <Typography variant="h6" color="primary.main">
                                {score.score}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(score.date).toLocaleDateString()}
                              </Typography>
                              {index > 0 && (
                                <Typography 
                                  variant="caption" 
                                  color={score.score > readinessScores[index - 1].score ? 'success.main' : 'error.main'}
                                  sx={{ fontWeight: 500 }}
                                >
                                  {score.score > readinessScores[index - 1].score ? '↗' : '↘'} 
                                  {Math.abs(score.score - readinessScores[index - 1].score).toFixed(1)} pts
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
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
                      <Typography variant="body2" color="primary.main">
                        Progress Trend: {(() => {
                          if (readinessScores.length < 2) return 'Insufficient data';
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

      {/* Checklist Progress by Stage - Detailed Progress Breakdown */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Checklist Progress by Stage
              </Typography>
              <Box sx={{ mt: 2 }}>
                {milestones && milestones.length > 0 ? (
                  <Grid container spacing={2}>
                    {milestones.map(stage => {
                      const totalTasks = stage.tasks?.length || 0;
                      const completedTasks = stage.tasks?.filter((task: any) => task.completed)?.length || 0;
                      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                      
                      return (
                        <Grid item xs={12} sm={6} md={3} key={stage.id}>
                          <Typography variant="h6" color="primary.main" gutterBottom>
                            {stage.title}
                          </Typography>
                          <Typography variant="h4" color="success.main">
                            {progress}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {completedTasks} of {totalTasks} tasks
                          </Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={progress}
                            sx={{ mt: 1, height: 6, borderRadius: 3 }}
                          />
                        </Grid>
                      );
                    })}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No checklist data available
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Simulation Analytics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Simulations by Type
                  </Typography>
                  <Box sx={{ mt: 2, height: 300, display: 'flex', alignItems: 'end', gap: 2, px: 2 }}>
                    {activities.filter(a => a.category === 'Simulation Facilitation').length > 0 ? (
                      <>
                        {Array.from(new Set(activities
                          .filter(a => a.category === 'Simulation Facilitation')
                          .map(a => a.simulation || 'Other')))
                          .map(simType => {
                            const count = activities.filter(a => 
                              a.category === 'Simulation Facilitation' && 
                              (a.simulation === simType || (a.simulation === undefined && simType === 'Other'))
                            ).length;
                            const totalSims = activities.filter(a => a.category === 'Simulation Facilitation').length;
                            const percentage = (count / totalSims) * 100;
                            const maxHeight = 200; // Maximum height for the tallest bar
                            const barHeight = (percentage / 100) * maxHeight;
                            
                            return (
                              <Box key={simType} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Box
                                  sx={{
                                    width: '100%',
                                    height: barHeight,
                                    bgcolor: 'primary.main',
                                    borderRadius: '4px 4px 0 0',
                                    position: 'relative',
                                    minHeight: '20px'
                                  }}
                                />
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    mt: 1, 
                                    textAlign: 'center', 
                                    fontSize: '0.7rem',
                                    lineHeight: 1.2,
                                    maxWidth: '100%',
                                    wordBreak: 'break-word'
                                  }}
                                >
                                  {simType === 'Other' ? 'Other' : simType}
                                </Typography>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    mt: 0.5, 
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    color: 'primary.main'
                                  }}
                                >
                                  {count}
                                </Typography>
                              </Box>
                            );
                          })}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No simulation activities recorded
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
                    Simulation Participants
                  </Typography>
                  <Box sx={{ mt: 2, height: 300, display: 'flex', alignItems: 'end', gap: 2, px: 2 }}>
                    {activities.filter(a => a.category === 'Simulation Facilitation').length > 0 ? (
                      <>
                        {Array.from(new Set(activities
                          .filter(a => a.category === 'Simulation Facilitation')
                          .map(a => a.simulation || 'Other')))
                          .map(simType => {
                            const simActivities = activities.filter(a => 
                              a.category === 'Simulation Facilitation' && 
                              (a.simulation === simType || (a.simulation === undefined && simType === 'Other'))
                            );
                            const totalParticipants = simActivities.reduce((sum, a) => sum + (a.participants || 0), 0);
                            const avgParticipants = simActivities.length > 0 ? Math.round(totalParticipants / simActivities.length) : 0;
                            
                            // Find the maximum participants to scale the bars appropriately
                            const allSimTypes = Array.from(new Set(activities
                              .filter(a => a.category === 'Simulation Facilitation')
                              .map(a => a.simulation || 'Other')));
                            const maxParticipants = Math.max(...allSimTypes.map(type => {
                              const typeActivities = activities.filter(a => 
                                a.category === 'Simulation Facilitation' && 
                                (a.simulation === type || (a.simulation === undefined && type === 'Other'))
                              );
                              return typeActivities.reduce((sum, a) => sum + (a.participants || 0), 0);
                            }));
                            
                            const maxHeight = 200;
                            const barHeight = maxParticipants > 0 ? (totalParticipants / maxParticipants) * maxHeight : 0;
                            
                            return (
                              <Box key={simType} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Box
                                  sx={{
                                    width: '100%',
                                    height: barHeight,
                                    bgcolor: 'secondary.main',
                                    borderRadius: '4px 4px 0 0',
                                    position: 'relative',
                                    minHeight: '20px'
                                  }}
                                />
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    mt: 1, 
                                    textAlign: 'center', 
                                    fontSize: '0.7rem',
                                    lineHeight: 1.2,
                                    maxWidth: '100%',
                                    wordBreak: 'break-word'
                                  }}
                                >
                                  {simType === 'Other' ? 'Other' : simType}
                                </Typography>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    mt: 0.5, 
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    color: 'secondary.main'
                                  }}
                                >
                                  {totalParticipants}
                                </Typography>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    textAlign: 'center',
                                    fontSize: '0.65rem',
                                    color: 'text.secondary'
                                  }}
                                >
                                  avg: {avgParticipants}
                                </Typography>
                              </Box>
                            );
                          })}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No simulation activities recorded
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>






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
                          const completedPlans = statusCounts['Completed'] || 0;
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

      {/* Activity Analysis - Work Tracking and Insights */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Activity Categories
              </Typography>
              <Box sx={{ mt: 2 }}>
                {activities.length > 0 ? (
                  <>
                    {Array.from(new Set(activities.map(a => a.category))).map(category => {
                      const count = activities.filter(a => a.category === category).length;
                      const percentage = (count / activities.length) * 100;
                      return (
                        <Box key={category} sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">
                              {category.length > 30 ? category.substring(0, 30) + '...' : category}
                            </Typography>
                            <Typography variant="body2">
                              {count} ({Math.round(percentage)}%)
                            </Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={percentage}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Box>
                      );
                    })}
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No activities data available
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
                PECC Work Hours Analysis
              </Typography>
              <Box sx={{ mt: 2 }}>
                {activities.length > 0 ? (
                  <Grid container spacing={2}>
                    {(() => {
                      const now = new Date();
                      const currentMonth = now.getMonth();
                      const currentYear = now.getFullYear();
                      
                      // Calculate hours for different time periods
                      const thisMonthHours = activities
                        .filter(a => {
                          const activityDate = new Date(a.date);
                          return activityDate.getMonth() === currentMonth && 
                                 activityDate.getFullYear() === currentYear;
                        })
                        .reduce((sum, a) => sum + (a.hours || 0), 0);
                      
                      const lastMonthHours = activities
                        .filter(a => {
                          const activityDate = new Date(a.date);
                          const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                          const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
                          return activityDate.getMonth() === lastMonth && 
                                 activityDate.getFullYear() === lastMonthYear;
                        })
                        .reduce((sum, a) => sum + (a.hours || 0), 0);
                      
                      const thisYearHours = activities
                        .filter(a => {
                          const activityDate = new Date(a.date);
                          return activityDate.getFullYear() === currentYear;
                        })
                        .reduce((sum, a) => sum + (a.hours || 0), 0);
                      
                      const totalHours = activities.reduce((sum, a) => sum + (a.hours || 0), 0);
                      
                      return (
                        <>
                          <Grid item xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
                              <Typography variant="h4" color="white">
                                {thisMonthHours}
                              </Typography>
                              <Typography variant="body2" color="white">
                                This Month
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'secondary.light', borderRadius: 1 }}>
                              <Typography variant="h4" color="white">
                                {lastMonthHours}
                              </Typography>
                              <Typography variant="body2" color="white">
                                Last Month
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                              <Typography variant="h4" color="white">
                                {thisYearHours}
                              </Typography>
                              <Typography variant="body2" color="white">
                                This Year
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                              <Typography variant="h4" color="white">
                                {totalHours}
                              </Typography>
                              <Typography variant="body2" color="white">
                                Total Hours
                              </Typography>
                            </Box>
                          </Grid>
                        </>
                      );
                    })()}
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

      {/* Checklist Progress by Stage */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Checklist Progress by Stage
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    {milestones && milestones.length > 0 ? (
                      <Grid container spacing={2}>
                        {milestones.map((stage: any) => {
                          const totalTasks = stage.tasks?.length || 0;
                          const completedTasks = stage.tasks?.filter((task: any) => task.completed)?.length || 0;
                          const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                          
                          return (
                            <Grid item xs={12} sm={6} md={3} key={stage.id}>
                              <Typography variant="h6" color="primary.main" gutterBottom>
                                {stage.title}
                              </Typography>
                              <Typography variant="h4" color="success.main">
                                {progress}%
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {completedTasks} of {totalTasks} tasks
                              </Typography>
                              <LinearProgress 
                                variant="determinate" 
                                value={progress}
                                sx={{ mt: 1, height: 6, borderRadius: 3 }}
                              />
                            </Grid>
                          );
                        })}
                      </Grid>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No checklist data available
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Activity Category Distribution */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Activity Category Distribution
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    {activities.length > 0 ? (
                      <>
                        {(() => {
                          const categoryStats = activities.reduce((acc, activity) => {
                            const category = activity.category;
                            if (!acc[category]) {
                              acc[category] = { count: 0, hours: 0 };
                            }
                            acc[category].count += 1;
                            acc[category].hours += activity.hours || 0;
                            return acc;
                          }, {} as Record<string, { count: number; hours: number }>);
                          
                          const sortedCategories = Object.entries(categoryStats)
                            .sort(([, a], [, b]) => (b as { hours: number }).hours - (a as { hours: number }).hours);
                          
                          return (
                            <Grid container spacing={2}>
                              {sortedCategories.map(([category, stats]) => (
                                <Grid item xs={12} sm={6} md={4} key={category}>
                                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>
                                      {category}
                                    </Typography>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <Box>
                                        <Typography variant="h6" color="primary.main">
                                          {(stats as { count: number }).count}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          Activities
                                        </Typography>
                                      </Box>
                                      <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="h6" color="success.main">
                                          {(stats as { hours: number }).hours}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          Hours
                                        </Typography>
                                      </Box>
                                    </Box>
                                  </Box>
                                </Grid>
                              ))}
                            </Grid>
                          );
                        })()}
                      </>
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

          {/* Points by Domain */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Points by Domain
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: '2fr 1fr 1fr 1fr',
                      gap: 2,
                      '& > div': { 
                        p: 2, 
                        display: 'flex', 
                        alignItems: 'center',
                        fontWeight: 'bold'
                      }
                    }}>
                      {/* Header Row */}
                      <Box sx={{ bgcolor: 'yellow', color: 'black', fontWeight: 'bold' }}>
                        Domain of Pediatric Readiness
                      </Box>
                      <Box sx={{ bgcolor: 'yellow', color: 'black', fontWeight: 'bold', justifyContent: 'center' }}>
                        Your Site's Points
                      </Box>
                      <Box sx={{ bgcolor: 'yellow', color: 'black', fontWeight: 'bold', justifyContent: 'center' }}>
                        Total Possible Points
                      </Box>
                      <Box sx={{ bgcolor: 'yellow', color: 'black', fontWeight: 'bold', justifyContent: 'center' }}>
                        Percent of Possible Points
                      </Box>
                      
                      {/* Data Rows */}
                      <Box sx={{ bgcolor: 'lightblue', color: 'black', fontWeight: 'bold' }}>
                        Administration & Coordination
                      </Box>
                      <Box sx={{ justifyContent: 'center' }}>0</Box>
                      <Box sx={{ justifyContent: 'center' }}>19</Box>
                      <Box sx={{ justifyContent: 'center' }}>0.0%</Box>
                      
                      <Box sx={{ bgcolor: 'lightblue', color: 'black', fontWeight: 'bold' }}>
                        Staffing
                      </Box>
                      <Box sx={{ justifyContent: 'center' }}>0</Box>
                      <Box sx={{ justifyContent: 'center' }}>10</Box>
                      <Box sx={{ justifyContent: 'center' }}>0.0%</Box>
                      
                      <Box sx={{ bgcolor: 'lightblue', color: 'black', fontWeight: 'bold' }}>
                        Quality Improvement
                      </Box>
                      <Box sx={{ justifyContent: 'center' }}>0</Box>
                      <Box sx={{ justifyContent: 'center' }}>7</Box>
                      <Box sx={{ justifyContent: 'center' }}>0.0%</Box>
                      
                      <Box sx={{ bgcolor: 'lightblue', color: 'black', fontWeight: 'bold' }}>
                        Patient Safety
                      </Box>
                      <Box sx={{ justifyContent: 'center' }}>0</Box>
                      <Box sx={{ justifyContent: 'center' }}>14</Box>
                      <Box sx={{ justifyContent: 'center' }}>0.0%</Box>
                      
                      <Box sx={{ bgcolor: 'lightblue', color: 'black', fontWeight: 'bold' }}>
                        Policies & Procedures
                      </Box>
                      <Box sx={{ justifyContent: 'center' }}>0</Box>
                      <Box sx={{ justifyContent: 'center' }}>17</Box>
                      <Box sx={{ justifyContent: 'center' }}>0.0%</Box>
                      
                      <Box sx={{ bgcolor: 'lightblue', color: 'black', fontWeight: 'bold' }}>
                        Equipment
                      </Box>
                      <Box sx={{ justifyContent: 'center' }}>0</Box>
                      <Box sx={{ justifyContent: 'center' }}>33</Box>
                      <Box sx={{ justifyContent: 'center' }}>0.0%</Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Percent of Possible Points per Domain Chart */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Percent of Possible Points per Domain of Pediatric Readiness
                  </Typography>
                  <Box sx={{ mt: 2, height: 300, display: 'flex', alignItems: 'end', justifyContent: 'space-around', px: 4 }}>
                    {/* Chart bars - currently empty as per the image */}
                    <Box sx={{ 
                      width: 60, 
                      height: 0, 
                      bgcolor: 'grey.300',
                      borderRadius: '4px 4px 0 0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      <Typography variant="caption" sx={{ mt: 1, transform: 'rotate(-45deg)', transformOrigin: 'center' }}>
                        Administration & Coordination
                      </Typography>
                    </Box>
                    <Box sx={{ 
                      width: 60, 
                      height: 0, 
                      bgcolor: 'grey.300',
                      borderRadius: '4px 4px 0 0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      <Typography variant="caption" sx={{ mt: 1, transform: 'rotate(-45deg)', transformOrigin: 'center' }}>
                        Staffing
                      </Typography>
                    </Box>
                    <Box sx={{ 
                      width: 60, 
                      height: 0, 
                      bgcolor: 'grey.300',
                      borderRadius: '4px 4px 0 0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      <Typography variant="caption" sx={{ mt: 1, transform: 'rotate(-45deg)', transformOrigin: 'center' }}>
                        Quality Improvement
                      </Typography>
                    </Box>
                    <Box sx={{ 
                      width: 60, 
                      height: 0, 
                      bgcolor: 'grey.300',
                      borderRadius: '4px 4px 0 0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      <Typography variant="caption" sx={{ mt: '1px', transform: 'rotate(-45deg)', transformOrigin: 'center' }}>
                        Patient Safety
                      </Typography>
                    </Box>
                    <Box sx={{ 
                      width: 60, 
                      height: 0, 
                      bgcolor: 'grey.300',
                      borderRadius: '4px 4px 0 0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      <Typography variant="caption" sx={{ mt: 1, transform: 'rotate(-45deg)', transformOrigin: 'center' }}>
                        Policies & Procedures
                      </Typography>
                    </Box>
                    <Box sx={{ 
                      width: 60, 
                      height: 0, 
                      bgcolor: 'grey.300',
                      borderRadius: '4px 4px 0 0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      <Typography variant="caption" sx={{ mt: 1, transform: 'rotate(-45deg)', transformOrigin: 'center' }}>
                        Equipment
                      </Typography>
                    </Box>
                  </Box>
                  {/* Y-axis labels */}
                  <Box sx={{ 
                    position: 'relative', 
                    height: 300, 
                    mt: -300, 
                    ml: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    pointerEvents: 'none'
                  }}>
                    {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map((percent) => (
                      <Typography key={percent} variant="caption" color="text.secondary">
                        {percent}.0%
                      </Typography>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>


        </Box>
      );
    } catch (error) {
      console.error('Error rendering SnapshotPage:', error);
      setRenderError(true);
      return (
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom color="error">
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            There was an error rendering the snapshot page. Please try refreshing.
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </Box>
      );
    }
  };

export default SnapshotPage;
