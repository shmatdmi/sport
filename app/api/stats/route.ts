import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const globalForPool = globalThis as unknown as { sportPool?: Pool };
const pool =
  globalForPool.sportPool ??
  new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 5,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") globalForPool.sportPool = pool;

const asNumber = (value: unknown) => Number(value || 0);
const knownExercises = ["Отжимания", "Подтягивания", "Пресс", "Приседания", "Бег"];
const percent = (current: number, previous: number) =>
  previous === 0 ? (current === 0 ? 0 : null) : Math.round(((current - previous) / previous) * 100);

export async function GET(request: NextRequest) {
  const requestedDays = Number(request.nextUrl.searchParams.get("days") || 30);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;

  try {
    const totalsResult = await pool.query(
      `SELECT type_sport AS name, COALESCE(SUM(count_sport), 0)::int AS total
       FROM public.stat_sport
       WHERE type_sport IS NOT NULL
       GROUP BY type_sport
       ORDER BY total DESC`,
    );

    const totals = new Map(
      totalsResult.rows.map((row) => [String(row.name), asNumber(row.total)]),
    );
    const requested = request.nextUrl.searchParams.get("exercise") || "Отжимания";
    const selected = knownExercises.includes(requested) ? requested : "Отжимания";

    const [summaryResult, dailyResult, recentResult, locationResult, datesResult] = await Promise.all([
      pool.query(
        `SELECT
          COALESCE(SUM(count_sport) FILTER (WHERE create_date >= NOW() - INTERVAL '7 days'), 0)::int AS week_total,
          COALESCE(SUM(count_sport) FILTER (WHERE create_date < NOW() - INTERVAL '7 days' AND create_date >= NOW() - INTERVAL '14 days'), 0)::int AS previous_week,
          COALESCE(SUM(count_sport) FILTER (WHERE create_date >= NOW() - INTERVAL '30 days'), 0)::int AS month_total,
          COALESCE(SUM(count_sport) FILTER (WHERE create_date < NOW() - INTERVAL '30 days' AND create_date >= NOW() - INTERVAL '60 days'), 0)::int AS previous_month,
          COALESCE(SUM(count_sport), 0)::int AS all_time,
          COUNT(DISTINCT create_date::date) FILTER (WHERE create_date >= NOW() - INTERVAL '30 days')::int AS active_days,
          COUNT(*) FILTER (WHERE create_date >= NOW() - INTERVAL '30 days')::int AS sessions,
          COALESCE(MAX(count_sport), 0)::int AS personal_best
        FROM public.stat_sport
        WHERE type_sport = $1`,
        [selected],
      ),
      pool.query(
        `WITH dates AS (
          SELECT generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, INTERVAL '1 day')::date AS day
        ), totals AS (
          SELECT create_date::date AS day, SUM(count_sport)::int AS total, COUNT(*)::int AS sessions
          FROM public.stat_sport
          WHERE type_sport = $1 AND create_date >= CURRENT_DATE - ($2::int - 1)
          GROUP BY create_date::date
        )
        SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
               COALESCE(t.total, 0)::int AS total,
               COALESCE(t.sessions, 0)::int AS sessions
        FROM dates d LEFT JOIN totals t USING (day)
        ORDER BY d.day`,
        [selected, days],
      ),
      pool.query(
        `SELECT id, type_sport AS type, count_sport AS count,
                location_sport AS location, time_sport AS duration,
                create_date AS "createdAt"
         FROM public.stat_sport
         WHERE type_sport = $1
         ORDER BY create_date DESC
         LIMIT 6`,
        [selected],
      ),
      pool.query(
        `SELECT COALESCE(NULLIF(TRIM(location_sport), ''), 'Не указано') AS name,
                SUM(count_sport)::int AS total
         FROM public.stat_sport
         WHERE type_sport = $1
         GROUP BY 1
         ORDER BY total DESC
         LIMIT 5`,
        [selected],
      ),
      pool.query(
        `SELECT TO_CHAR(create_date::date, 'YYYY-MM-DD') AS date
         FROM public.stat_sport
         WHERE type_sport = $1
         GROUP BY create_date::date
         ORDER BY create_date::date DESC`,
        [selected],
      ),
    ]);

    const row = summaryResult.rows[0];
    const weekTotal = asNumber(row.week_total);
    const previousWeek = asNumber(row.previous_week);
    const monthTotal = asNumber(row.month_total);
    const previousMonth = asNumber(row.previous_month);

    const activityDates = new Set(datesResult.rows.map((item) => item.date));
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    const todayKey = cursor.toISOString().slice(0, 10);
    if (!activityDates.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (activityDates.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      selected,
      days,
      exercises: knownExercises.map((name) => ({
        name,
        total: totals.get(name) || 0,
      })),
      summary: {
        week: {
          total: weekTotal,
          average: Math.round(weekTotal / 7),
          previousTotal: previousWeek,
          changePercent: percent(weekTotal, previousWeek),
        },
        month: {
          total: monthTotal,
          average: Math.round(monthTotal / 30),
          previousTotal: previousMonth,
          changePercent: percent(monthTotal, previousMonth),
        },
        allTime: asNumber(row.all_time),
        activeDays30: asNumber(row.active_days),
        sessions30: asNumber(row.sessions),
        streak,
        personalBest: asNumber(row.personal_best),
      },
      daily: dailyResult.rows.map((item) => ({
        date: item.date,
        total: asNumber(item.total),
        sessions: asNumber(item.sessions),
      })),
      recent: recentResult.rows,
      locations: locationResult.rows.map((item) => ({
        name: item.name,
        total: asNumber(item.total),
      })),
    });
  } catch (error) {
    console.error("Sport statistics query failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}
