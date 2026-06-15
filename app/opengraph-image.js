import { ImageResponse } from "next/og";
import { OgImage, OG_SIZE, OG_ALT } from "@/lib/ogImage";

// Open Graph card (Discord / Slack / iMessage / Facebook / LinkedIn). Next wires
// this into <meta property="og:image"> automatically; the artwork lives in
// lib/ogImage so the Twitter card can share it verbatim.
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<OgImage />, { ...OG_SIZE });
}
