/**
 * Shared PRS scoring for Snapshot (and aligned with PRS page conventions).
 * Domain mapping matches the PRS questionnaire structure.
 */

export interface PRSQuestion {
  id: string;
  text: string;
  type: 'yesno' | 'radio' | 'checkbox' | 'text' | 'numeric' | 'paragraph' | 'subquestions' | 'header';
  options?: string[];
  subQuestions?: PRSQuestion[];
  answer?: string | string[] | null;
  points?: number;
}

export const DOMAIN_QUESTION_MAPPING: Record<string, string[]> = {
  'Administration & Coordination': ['22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38'],
  'Staffing': ['39', '40', '41', '42', '43', '44a', '44b', '44c', '44d', '44e'],
  'Quality Improvement': ['45', '46', '47', '48', '49', '50', '51'],
  'Patient Safety': ['52', '53', '54', '55', '56', '57', '58', '59', '60', '61a', '61b', '61c', '61d', '61e', '62'],
  'Policies & Procedures': ['63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79'],
  'Equipment': ['80', '81', '82', '83', '84', '85', '86', '87', '88', '89', '90', '91', '92', '93', '94', '95', '96', '97', '98', '99', '100']
};

export const DOMAIN_MAX_POINTS: Record<string, number> = {
  'Administration & Coordination': 19,
  'Staffing': 10,
  'Quality Improvement': 7,
  'Patient Safety': 14,
  'Policies & Procedures': 17,
  'Equipment': 33
};

function shouldEarnPointsForAnswer(question: PRSQuestion): boolean {
  if (!question.answer) return false;
  if (question.type === 'yesno') return question.answer === 'yes';
  if (question.type === 'radio') return true;
  if (question.type === 'checkbox') return Array.isArray(question.answer) && question.answer.length > 0;
  if (question.type === 'text' || question.type === 'numeric' || question.type === 'paragraph') {
    return question.answer !== '' && question.answer !== null;
  }
  return true;
}

/** Per-question earned and max points (recursive for subquestions). */
export function calculateQuestionPoints(question: PRSQuestion): { earned: number; total: number } {
  let earned = 0;
  let total = 0;

  if (question.points) {
    total = question.points;
    if (shouldEarnPointsForAnswer(question)) {
      earned = question.points;
    }
  }

  if (question.subQuestions) {
    question.subQuestions.forEach((subQ) => {
      const sub = calculateQuestionPoints(subQ);
      earned += sub.earned;
      total += sub.total;
    });
  }

  return { earned, total };
}

export function calculateDomainScores(
  questions: PRSQuestion[] | null
): Record<string, { earned: number; total: number; percentage: number }> | null {
  if (!questions || !Array.isArray(questions)) return null;

  const domainData: Record<string, { earned: number; total: number; percentage: number }> = {};

  Object.entries(DOMAIN_QUESTION_MAPPING).forEach(([domain, questionIds]) => {
    let domainEarned = 0;
    const domainTotal = DOMAIN_MAX_POINTS[domain] || 0;

    questionIds.forEach((qId) => {
      const question = questions.find((q) => q.id === qId);
      if (question) {
        const points = calculateQuestionPoints(question);
        domainEarned += points.earned;
      }
    });

    domainData[domain] = {
      earned: domainEarned,
      total: domainTotal,
      percentage: domainTotal > 0 ? Math.round((domainEarned / domainTotal) * 100) : 0
    };
  });

  return domainData;
}

/** Overall PRS percentage from question tree (matches “live” PRS on the page). */
export function calculateCurrentPRSScorePercent(questions: PRSQuestion[] | null): number | null {
  if (!questions || !Array.isArray(questions)) return null;

  let totalPoints = 0;
  let earnedPoints = 0;

  const accumulate = (question: PRSQuestion): void => {
    if (question.points) {
      totalPoints += question.points;
      if (shouldEarnPointsForAnswer(question)) {
        earnedPoints += question.points;
      }
    }
    if (question.subQuestions) {
      question.subQuestions.forEach((subQ) => accumulate(subQ));
    }
  };

  questions.forEach((q) => accumulate(q));

  if (totalPoints <= 0) return null;
  return Math.round((earnedPoints / totalPoints) * 100);
}
