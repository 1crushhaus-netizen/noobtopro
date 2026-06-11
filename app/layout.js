import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  title: "noobtopro — prove what you know",
  description:
    "Real problems in math, physics, and chemistry. Your reasoning is graded — not just the answer. Get ranked from Elementary to Doctorate, then climb.",
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

// Resolve the saved theme BEFORE first paint so there is never a flash of the
// wrong theme. Dark is the product default; "system" is an explicit opt-in via
// the theme switcher. Runs inline in <head> (CSP allows 'unsafe-inline').
const THEME_INIT = `(function(){try{var p=localStorage.getItem("np-theme");var t=p==="light"?"light":p==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
