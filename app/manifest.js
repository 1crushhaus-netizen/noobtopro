// Web App Manifest (served at /manifest.webmanifest). Lets the site be installed
// to a home screen and tints the standalone window with the brand teal. Colors
// mirror the dark surface (--bg) and the physics-teal accent (themeColor).
export default function manifest() {
  return {
    name: "noobtopro",
    short_name: "noobtopro",
    description:
      "Real problems in math, physics, and chemistry. Your reasoning is graded, not just the answer. Get ranked from Elementary to Doctorate, then climb.",
    start_url: "/",
    display: "standalone",
    background_color: "#56897e",
    theme_color: "#56897e",
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
