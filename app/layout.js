import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  title: "noobtopro",
  description: "Prove what you know. Climb from noob to pro.",
};

// viewport-fit=cover lets the app paint into the notch/home-indicator area; the
// globals.css safe-area-inset padding then keeps content (and the drawer/modal close
// buttons + bottom CTAs) clear of them. width/initialScale replace Next's default
// viewport meta, so they must be restated here.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
