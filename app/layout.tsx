import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://84.54.57.64:787"),
  title: "Мой ритм — статистика тренировок",
  description: "Личный дашборд тренировок: динамика, объём, серии и сравнение периодов.",
  openGraph: {
    title: "Мой ритм — тренировки в цифрах",
    description: "Личный дашборд прогресса: объём, динамика и серии.",
    type: "website",
    locale: "ru_RU",
    images: [{ url: "/og.png", width: 1734, height: 907, alt: "Мой ритм — тренировки в цифрах" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Мой ритм — тренировки в цифрах",
    description: "Личный дашборд прогресса: объём, динамика и серии.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
