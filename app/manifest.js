// Web App Manifest (served at /manifest.webmanifest). Lets the site be installed
// to a home screen and paints the standalone window in the true-black brand
// surface. Colors mirror the dark default --bg (#000000) so the installed app,
// the splash screen and app/apple-icon.js all share the same greyscale identity
// (the brand is strictly greyscale per globals.css; the teal is a subject accent
// reserved for meaning, never page chrome).
export default function manifest() {
  return {
    name: "noobtopro",
    short_name: "noobtopro",
    description:
      "Real problems in math, physics, and chemistry. Your reasoning is graded, not just the answer. Get ranked from Elementary to Doctorate, then climb.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        type: "image/png",
        sizes: "180x180",
        purpose: "any",
      },
    ],
  };
}
