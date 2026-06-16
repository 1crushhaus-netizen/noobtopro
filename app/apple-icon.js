import { ImageResponse } from "next/og";

// Apple touch icon (180x180) for iOS "Add to Home Screen". Next wires this into
// <link rel="apple-touch-icon"> automatically. Mirrors the next/og pattern in
// app/opengraph-image.js; renders the noob->pro arrow glyph (matching
// app/icon.svg) on the physics-teal brand surface so the home-screen tile is
// on-brand. iOS masks/rounds the corners itself, so this fills the full square.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#56897e",
        }}
      >
        <svg width="116" height="116" viewBox="0 0 64 64">
          <path
            d="M15 32h31M34 19l13 13-13 13"
            fill="none"
            stroke="#ffffff"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
