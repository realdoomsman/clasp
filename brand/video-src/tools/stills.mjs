// Render stills: node tools/stills.mjs <compId> <outDir> <frame,frame,...|every:N> [scale] [inputPropsJSON]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const [comp, outDir, spec, scaleArg, propsArg] = process.argv.slice(2);
const inputProps = propsArg ? JSON.parse(propsArg) : {};
const scale = Number(scaleArg ?? 0.5);
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const browser = await openBrowser("chrome");
const composition = await selectComposition({ serveUrl, id: comp, puppeteerInstance: browser, inputProps });
let frames;
if (spec.startsWith("every:")) {
  const n = Number(spec.slice(6));
  frames = [];
  for (let f = 0; f < composition.durationInFrames; f += n) frames.push(f);
} else frames = spec.split(",").map(Number);
for (const frame of frames) {
  const output = path.join(outDir, `${comp}-${String(frame).padStart(5, "0")}.png`);
  await renderStill({ serveUrl, composition, frame, output, scale, puppeteerInstance: browser, inputProps });
  console.log("still", frame);
}
await browser.close({ silent: true });
