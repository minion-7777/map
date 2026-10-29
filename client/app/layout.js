import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata = {
  title: "Dandong Map",
  description: "단동회사목록 조회 및 등록 ",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport = {
  themeColor: "#143646",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
