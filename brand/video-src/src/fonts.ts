import { continueRender, delayRender, staticFile } from "remotion";

let started = false;

export const ensureFonts = () => {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("Loading brand fonts");
  const faces = [
    new FontFace("Outfit", `url(${staticFile("fonts/Outfit.ttf")}) format("truetype")`, { weight: "100 900" }),
    new FontFace("Inter", `url(${staticFile("fonts/Inter.ttf")}) format("truetype")`, { weight: "100 900" }),
  ];
  const set = document.fonts as unknown as { add: (f: FontFace) => void };
  Promise.all(faces.map((f) => f.load().then((ff) => set.add(ff))))
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
};
