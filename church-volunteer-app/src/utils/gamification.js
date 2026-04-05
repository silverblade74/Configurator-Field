/**
 * Gamification Engine
 *
 * Points System:
 * - 10 points per hour served
 * - 25 bonus points for first event ever
 * - 15 bonus points per 4-week streak maintained
 * - Milestone bonuses at hour thresholds
 *
 * Streaks:
 * - A streak increments weekly if the volunteer serves at least once per week
 * - Missing a week resets the streak to 0
 *
 * Leaderboard:
 * - Monthly leaderboard resets on the 1st of each month
 * - All-time leaderboard persists
 */

export const POINTS_PER_HOUR = 10
export const FIRST_EVENT_BONUS = 25
export const STREAK_BONUS = 15 // per 4-week streak

export const MILESTONE_BONUSES = {
  1: 10,
  10: 50,
  25: 100,
  50: 200,
  100: 500,
  250: 1000,
  500: 2500,
}

export function calculatePoints(hoursLogged, isFirstEvent = false) {
  let points = Math.floor(hoursLogged * POINTS_PER_HOUR)
  if (isFirstEvent) points += FIRST_EVENT_BONUS
  return points
}

export function calculateStreakBonus(currentStreak) {
  const streakMultiple = Math.floor(currentStreak / 4)
  return streakMultiple * STREAK_BONUS
}

export function getMilestoneBonus(oldHours, newHours) {
  let bonus = 0
  for (const [threshold, points] of Object.entries(MILESTONE_BONUSES)) {
    const t = Number(threshold)
    if (oldHours < t && newHours >= t) {
      bonus += points
    }
  }
  return bonus
}

export function getNextMilestone(currentHours) {
  const thresholds = [1, 10, 25, 50, 100, 250, 500]
  return thresholds.find((t) => t > currentHours) || null
}

export function formatHours(hours) {
  if (!hours) return '0h'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function getLevel(totalPoints) {
  if (totalPoints >= 5000) return { level: 5, name: 'Platinum', color: 'text-purple-600' }
  if (totalPoints >= 2000) return { level: 4, name: 'Gold', color: 'text-yellow-600' }
  if (totalPoints >= 1000) return { level: 3, name: 'Silver', color: 'text-gray-500' }
  if (totalPoints >= 500) return { level: 2, name: 'Bronze', color: 'text-orange-600' }
  return { level: 1, name: 'Newcomer', color: 'text-blue-600' }
}
