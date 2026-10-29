import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata = {
  title: "Dandong Map",
  description: "An offline map of companies in Dandong, on the Yalu River.",
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
