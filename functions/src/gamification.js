export const POINTS_PER_HOUR = 10

export function pointsForHours(hours) {
  return Math.max(0, Math.floor(Number(hours || 0) * POINTS_PER_HOUR))
}

export function badgeIdsForUser(user) {
  const hours = Number(user.totalHours || 0)
  const points = Number(user.totalPoints || 0)
  const badges = []
  if (hours > 0) badges.push('first_event')
  if (hours >= 10) badges.push('hours_10')
  if (hours >= 50) badges.push('hours_50')
  if (hours >= 100) badges.push('hours_100')
  if (hours >= 250) badges.push('hours_250')
  if (points >= 500) badges.push('points_500')
  if (points >= 2000) badges.push('points_2000')
  return badges
}
