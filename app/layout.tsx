import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActionButtons from "@/components/FloatingActionButtons";

const siteUrl = "https://daejeon-seven-night.com";
const title =
  "대전세븐나이트 웨이터 딸기 | 010-9562-0035";
const description =
  "대전세븐나이트 웨이터 딸기 010-9562-0035. 대전광역시 중구 유천동 332-28 방문 전 가격, 시간대, 룸 분위기, 주류 세트, 드레스코드, 재방문 케어까지 실제 텍스트로 안내합니다.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords: [
    "대전세븐나이트",
    "중구세븐나이트",
    "대전 세븐나이트 예약",
    "중구 세븐나이트 예약",
    "웨이터 딸기",
    "유천동 나이트",
    "대전 나이트클럽",
    "대전세븐나이트 부킹",
    "중구세븐나이트 부킹",
    "대전세븐나이트 오는길"
  ],
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName: "대전세븐나이트 웨이터 딸기",
    title,
    description,
    images: [
      {
        url: "/images/seven%20(1).png",
        width: 2400,
        height: 1000,
        alt: "대전세븐나이트 웨이터 딸기 010-9562-0035"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/images/seven%20(1).png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  category: "nightlife"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <FloatingActionButtons />
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
