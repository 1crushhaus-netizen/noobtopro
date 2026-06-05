import "./globals.css";

export const metadata = {
  title: "noobtopro",
  description: "Prove what you know. Climb from noob to pro.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
