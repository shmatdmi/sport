"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Period = {
  total: number;
  average: number;
  previousTotal: number;
  changePercent: number | null;
};

type DashboardData = {
  generatedAt: string;
  selected: string;
  days: number;
  exercises: Array<{ name: string; total: number }>;
  summary: {
    week: Period;
    month: Period;
    allTime: number;
    activeDays30: number;
    sessions30: number;
    streak: number;
    personalBest: number;
  };
  daily: Array<{ date: string; total: number; sessions: number }>;
  recent: Array<{
    id: number;
    type: string;
    count: number;
    location: string | null;
    duration: number | null;
    createdAt: string;
  }>;
  locations: Array<{ name: string; total: number }>;
};

const ranges = [7, 30, 90] as const;
const number = new Intl.NumberFormat("ru-RU");

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="delta neutral">новый темп</span>;
  const positive = value >= 0;
  return (
    <span className={`delta ${positive ? "positive" : "negative"}`}>
      {positive ? "↗" : "↘"} {Math.abs(value)}%
    </span>
  );
}

function shortDate(date: string, days: number) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: days > 30 ? "short" : undefined,
    timeZone: "Europe/Moscow",
  }).format(new Date(`${date}T12:00:00`));
}

function DashboardSkeleton() {
  return (
    <main className="shell">
      <div className="loading-line" />
      <section className="loading-grid">
        <div className="loading-block large" />
        <div className="loading-block" />
        <div className="loading-block" />
        <div className="loading-block wide" />
      </section>
    </main>
  );
}

export default function Home() {
  const [exercise, setExercise] = useState("Отжимания");
  const [days, setDays] = useState<(typeof ranges)[number]>(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/stats?exercise=${encodeURIComponent(exercise)}&days=${days}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Не удалось получить статистику");
      setData((await response.json()) as DashboardData);
    } catch {
      setError("Не удалось связаться с базой данных");
    } finally {
      setLoading(false);
    }
  }, [days, exercise]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDay = useMemo(
    () => Math.max(1, ...(data?.daily.map((item) => item.total) ?? [1])),
    [data],
  );

  if (loading && !data) return <DashboardSkeleton />;

  if (!data) {
    return (
      <main className="shell error-state">
        <p className="eyebrow">МОЙ РИТМ</p>
        <h1>Данные пока<br />не на связи.</h1>
        <p>{error}</p>
        <button className="primary-button" onClick={() => void load()}>Попробовать снова</button>
      </main>
    );
  }

  const consistency = Math.min(100, Math.round((data.summary.activeDays30 / 30) * 100));
  const lastUpdated = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit", minute: "2-digit", day: "numeric", month: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date(data.generatedAt));

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Мой ритм — начало страницы">
          <span className="brand-mark">MR</span>
          <span>МОЙ РИТМ</span>
        </a>
        <div className="live-status">
          <span className="live-dot" />
          Данные обновлены {lastUpdated}
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">ЛИЧНАЯ СТАТИСТИКА · МОСКВА</p>
          <h1>Тренировки<br /><span>/ в цифрах.</span></h1>
        </div>
        <p className="intro-copy">
          Не мотивация, а факты. Каждый подход из Jenkins превращается
          в понятную картину прогресса.
        </p>
      </section>

      <nav className="exercise-tabs" aria-label="Выбор упражнения">
        {data.exercises.map((item) => (
          <button
            key={item.name}
            className={exercise === item.name ? "active" : ""}
            onClick={() => setExercise(item.name)}
          >
            <span>{item.name}</span>
            <small>{number.format(item.total)}</small>
          </button>
        ))}
      </nav>

      <section className="hero-grid">
        <article className="hero-card dark-card">
          <div className="card-heading">
            <span>ПОСЛЕДНИЕ 7 ДНЕЙ</span>
            <Delta value={data.summary.week.changePercent} />
          </div>
          <div className="hero-number">
            {number.format(data.summary.week.total)}
            <small>{exercise === "Бег" ? "единиц" : "повторений"}</small>
          </div>
          <div className="comparison">
            <span>предыдущие 7 дней</span>
            <strong>{number.format(data.summary.week.previousTotal)}</strong>
          </div>
          <div className="accent-slash">/</div>
        </article>

        <article className="hero-card consistency-card">
          <div className="card-heading">
            <span>РЕГУЛЯРНОСТЬ</span>
            <span>30 ДНЕЙ</span>
          </div>
          <div
            className="consistency-ring"
            style={{ "--progress": `${consistency * 3.6}deg` } as React.CSSProperties}
          >
            <div>
              <strong>{data.summary.activeDays30}</strong>
              <span>активных<br />дней</span>
            </div>
          </div>
          <p>{data.summary.sessions30} тренировочных записей за месяц</p>
        </article>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <span>В СРЕДНЕМ / ДЕНЬ</span>
          <strong>{number.format(data.summary.week.average)}</strong>
          <p>за последние 7 дней</p>
        </article>
        <article className="metric-card">
          <span>ЗА 30 ДНЕЙ</span>
          <strong>{number.format(data.summary.month.total)}</strong>
          <p><Delta value={data.summary.month.changePercent} /> к прошлому периоду</p>
        </article>
        <article className="metric-card accent-card">
          <span>ТЕКУЩАЯ СЕРИЯ</span>
          <strong>{data.summary.streak}<small> дн.</small></strong>
          <p>дни подряд с активностью</p>
        </article>
        <article className="metric-card">
          <span>ЛУЧШИЙ ПОДХОД</span>
          <strong>{number.format(data.summary.personalBest)}</strong>
          <p>максимум за одну запись</p>
        </article>
      </section>

      <section className="chart-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">ДИНАМИКА</p>
            <h2>{exercise} по дням</h2>
          </div>
          <div className="range-switch" aria-label="Период графика">
            {ranges.map((range) => (
              <button
                key={range}
                className={days === range ? "active" : ""}
                onClick={() => setDays(range)}
              >
                {range}д
              </button>
            ))}
          </div>
        </div>
        <div className={`bar-chart days-${days}`} aria-label="График количества повторений по дням">
          {data.daily.map((item, index) => (
            <div className="bar-column" key={item.date}>
              <div className="bar-value">{item.total || ""}</div>
              <div
                className="bar"
                style={{ height: `${Math.max(item.total ? 8 : 2, (item.total / maxDay) * 100)}%` }}
                title={`${item.date}: ${item.total}`}
              />
              {(days <= 7 || index % (days === 30 ? 5 : 15) === 0) && (
                <span>{shortDate(item.date, days)}</span>
              )}
            </div>
          ))}
        </div>
        <div className="chart-footer">
          <span>Суммарно за всё время</span>
          <strong>{number.format(data.summary.allTime)}</strong>
        </div>
      </section>

      <section className="lower-grid">
        <article className="activity-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">ПОСЛЕДНИЕ ЗАПИСИ</p>
              <h2>Лента тренировок</h2>
            </div>
            <span className="record-count">{data.recent.length}</span>
          </div>
          <div className="records">
            {data.recent.map((record) => (
              <div className="record" key={record.id}>
                <div className="record-date">
                  <strong>{new Intl.DateTimeFormat("ru-RU", { day: "2-digit", timeZone: "Europe/Moscow" }).format(new Date(record.createdAt))}</strong>
                  <span>{new Intl.DateTimeFormat("ru-RU", { month: "short", timeZone: "Europe/Moscow" }).format(new Date(record.createdAt)).replace(".", "")}</span>
                </div>
                <div className="record-main">
                  <strong>{record.type}</strong>
                  <span>{record.location || "Место не указано"}</span>
                </div>
                <div className="record-result">
                  <strong>{number.format(record.count)}</strong>
                  <span>{record.duration ? `${record.duration} мин` : "повторений"}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <aside className="locations-card">
          <p className="eyebrow">ГЕОГРАФИЯ</p>
          <h2>Где был сделан объём</h2>
          <div className="locations">
            {data.locations.map((location, index) => {
              const locationMax = data.locations[0]?.total || 1;
              return (
                <div className="location-row" key={location.name}>
                  <div>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{location.name}</strong>
                    <b>{number.format(location.total)}</b>
                  </div>
                  <div className="location-track">
                    <i style={{ width: `${(location.total / locationMax) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="month-average">
            <span>Среднее за 30 дней</span>
            <strong>{number.format(data.summary.month.average)}<small> / день</small></strong>
          </div>
        </aside>
      </section>

      <footer>
        <span>МОЙ РИТМ · {new Date().getFullYear()}</span>
        <span>Источник данных: Jenkins → PostgreSQL</span>
      </footer>
    </main>
  );
}
