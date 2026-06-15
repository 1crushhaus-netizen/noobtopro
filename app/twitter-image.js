import { ImageResponse } from "next/og";
import { OgImage, OG_SIZE, OG_ALT, ogFonts } from "@/lib/ogImage";

// Twitter/X large-summary card. Same artwork + fonts as the Open Graph image;
// Next wires it into <meta name="twitter:image"> automatically.
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<OgImage />, { ...OG_SIZE, fonts: ogFonts() });
}
