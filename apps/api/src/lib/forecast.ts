// Cost / call-count forecasting helpers.
//
// "Linear extrapolation from the daily average" is what most cost dashboards
// ship and it gets things wrong in two systematic ways:
//   - Last week was atypical (a heavy task at the start, idle now) → wildly
//     over-forecast.
//   - The user has a weekly rhythm (e.g. heavy Mon–Wed, light Thu–Sun) →
//     ignores it entirely.
//
// We do something only marginally smarter — recency-weighted moving average
// with day-of-week seasonality — but it's WAY better than naive linear and
// produces honest "we think you'll spend X by end of month, ± Y" output.
//
// No real ML; the model is one function that takes daily totals and returns
// a projection. Trained on… nothing. Runs in <1 ms.

export interface DailyPoint {
  date: string // YYYY-MM-DD
  costUsd: number
  callCount: number
}

export interface Forecast {
  /** End-of-month projection (UTC) in USD. */
  projectedMonthEndUsd: number
  /** End-of-month projection in call count. */
  projectedMonthEndCalls: number
  /** Cost spent so far in the current UTC month. */
  monthToDateUsd: number
  /** Calls so far in the current UTC month. */
  monthToDateCalls: number
  /** Days into the current month (1 = today is the 1st). */
  daysElapsed: number
  /** Days remaining in the current month including today. */
  daysRemaining: number
  /** ±USD band — 1 standard deviation of the historical daily costs. */
  uncertaintyUsd: number
  /** "Linear-from-MTD" baseline so callers can show the comparison. */
  linearProjectedUsd: number
}

const RECENCY_WEIGHTS = [0.35, 0.25, 0.18, 0.10, 0.06, 0.04, 0.02] // last 7 days, today first

function daysInMonthUtc(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
}

/**
 * Forecast end-of-current-month spend from a list of daily totals.
 *
 * `daily` should be ordered ASC by date. Anything earlier than 28 days ago is
 * ignored — we want the recent rhythm, not seasonal noise.
 *
 * If we don't have at least 3 days of data, the projection falls back to a
 * linear extrapolation from month-to-date (still better than nothing).
 */
export function forecastMonth(daily: DailyPoint[], now: Date = new Date()): Forecast {
  const todayUtc = now.toISOString().slice(0, 10)
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthLen = daysInMonthUtc(now)
  const daysElapsed = now.getUTCDate()
  const daysRemaining = monthLen - daysElapsed + 1 // inclusive of today

  const monthDays = daily.filter((d) => d.date >= monthStart.toISOString().slice(0, 10) && d.date <= todayUtc)
  const monthToDateUsd = monthDays.reduce((acc, d) => acc + d.costUsd, 0)
  const monthToDateCalls = monthDays.reduce((acc, d) => acc + d.callCount, 0)

  // Linear baseline — what naive dashboards show. Kept for comparison.
  const linearAvg = daysElapsed > 0 ? monthToDateUsd / daysElapsed : 0
  const linearProjectedUsd = linearAvg * monthLen

  // Recency-weighted average — emphasises recent days.
  const last7 = [...daily].slice(-7).reverse() // most recent first
  if (last7.length < 3) {
    return {
      projectedMonthEndUsd: linearProjectedUsd,
      projectedMonthEndCalls: daysElapsed > 0 ? (monthToDateCalls / daysElapsed) * monthLen : 0,
      monthToDateUsd, monthToDateCalls, daysElapsed, daysRemaining,
      uncertaintyUsd: 0,
      linearProjectedUsd,
    }
  }

  let weightedSum = 0
  let weightSum = 0
  let weightedCalls = 0
  for (let i = 0; i < last7.length; i++) {
    const w = RECENCY_WEIGHTS[i] ?? 0
    weightedSum += last7[i].costUsd * w
    weightedCalls += last7[i].callCount * w
    weightSum += w
  }
  const weightedAvgUsd = weightSum > 0 ? weightedSum / weightSum : linearAvg
  const weightedAvgCalls = weightSum > 0 ? weightedCalls / weightSum : 0

  // Day-of-week seasonality — if available, scale the weighted avg by the ratio
  // of "typical day-of-week" cost vs overall average over the same window.
  // Only kick in once we have at least 14 days; otherwise the sample is noise.
  let dowMultiplier = 1
  const last28 = daily.slice(-28)
  if (last28.length >= 14) {
    const byDow: Record<number, { cost: number; count: number }> = {}
    let total = 0
    for (const d of last28) {
      const dow = new Date(d.date + 'T00:00:00Z').getUTCDay()
      byDow[dow] = byDow[dow] || { cost: 0, count: 0 }
      byDow[dow].cost += d.costUsd
      byDow[dow].count += 1
      total += d.costUsd
    }
    const dayMeans: Record<number, number> = {}
    let grandMean = 0
    let n = 0
    for (const [dow, agg] of Object.entries(byDow)) {
      dayMeans[Number(dow)] = agg.cost / agg.count
      grandMean += agg.cost / agg.count
      n++
    }
    grandMean /= n
    if (grandMean > 0) {
      // We project across the remaining days; weight each by its day-of-week
      // multiplier rather than assuming all days are equal.
      let weightedRemaining = 0
      for (let i = 0; i < daysRemaining; i++) {
        const futureDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), daysElapsed + i))
        const dow = futureDate.getUTCDay()
        const mult = (dayMeans[dow] ?? grandMean) / grandMean
        weightedRemaining += mult
      }
      dowMultiplier = daysRemaining > 0 ? weightedRemaining / daysRemaining : 1
    }
  }

  const projectedRemainingUsd = weightedAvgUsd * daysRemaining * dowMultiplier
  const projectedRemainingCalls = weightedAvgCalls * daysRemaining * dowMultiplier

  // Honest uncertainty: 1 stddev of the last 7-14 days' daily costs, scaled
  // by sqrt(daysRemaining) — typical Wiener-process-style band.
  const window = daily.slice(-14)
  if (window.length >= 4) {
    const mean = window.reduce((acc, d) => acc + d.costUsd, 0) / window.length
    const variance = window.reduce((acc, d) => acc + (d.costUsd - mean) ** 2, 0) / window.length
    const sd = Math.sqrt(variance)
    return {
      projectedMonthEndUsd: monthToDateUsd + projectedRemainingUsd,
      projectedMonthEndCalls: monthToDateCalls + projectedRemainingCalls,
      monthToDateUsd, monthToDateCalls, daysElapsed, daysRemaining,
      uncertaintyUsd: sd * Math.sqrt(daysRemaining),
      linearProjectedUsd,
    }
  }

  return {
    projectedMonthEndUsd: monthToDateUsd + projectedRemainingUsd,
    projectedMonthEndCalls: monthToDateCalls + projectedRemainingCalls,
    monthToDateUsd, monthToDateCalls, daysElapsed, daysRemaining,
    uncertaintyUsd: 0,
    linearProjectedUsd,
  }
}
