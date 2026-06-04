/** Shared activity category + simulation helpers for mentor Overview and Dashboard. */

export const getActivityCategories = (activity: {
  categories?: unknown;
  category?: unknown;
}): string[] => {
  if (Array.isArray(activity.categories)) {
    const normalized = activity.categories
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    if (normalized.length > 0) return normalized;
  }
  const fallback = String(activity.category || '').trim();
  return fallback ? [fallback] : [];
};

export const hasActivityCategory = (
  activity: { categories?: unknown; category?: unknown },
  category: string
): boolean => getActivityCategories(activity).includes(category);

export const displayActivityCategories = (activity: {
  categories?: unknown;
  category?: unknown;
}): string => {
  const normalized = getActivityCategories(activity);
  return normalized.length > 0 ? normalized.join(', ') : 'Uncategorized';
};

export const isSimulationActivity = (activity: {
  categories?: unknown;
  category?: unknown;
  simulation?: unknown;
}): boolean =>
  hasActivityCategory(activity, 'SC') ||
  hasActivityCategory(activity, 'Simulation Case Facilitation') ||
  hasActivityCategory(activity, 'Simulation Facilitation') ||
  Boolean(activity.simulation);
