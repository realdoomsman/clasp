// Refine a few element rects: smallest element whose text contains all needles.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
const OUT = "C:/tech/Clasp/brand/video-src/public/ui/rects.json";
const rects = JSON.parse(fs.readFileSync(OUT, "utf8"));
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  userDataDir: "C:/tech/Clasp/brand/x/video/work/chrome-profile",
  args: ["--hide-scrollbars"],
});
const smallest = (page, needles) =>
  page.evaluate((needles) => {
    let best = null;
    for (const el of document.querySelectorAll("body *")) {
      const t = el.innerText || "";
      if (!needles.every((n) => t.includes(n))) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const a = r.width * r.height;
      if (!best || a < best.a) best = { a, x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
    }
    if (best) delete best.a;
    return best;
  }, needles);
async function run(url, key, specs) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto("https://clasp.fun" + url, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1500));
  for (const [name, needles] of Object.entries(specs)) rects[key][name] = await smallest(page, needles);
  await page.close();
}
await run("/", "home", { badge: ["On Robinhood Chain", "paid in ETH"], hero: ["Lock a coin", "Launch a coin"] });
await run("/coins/0x1fFBca055F0f0d1c5F81b456540DF1f395D9E173", "coin", {
  boost: ["Your boost", "Your share of fees"],
  feeRows: ["Clasp fee (2%)", "You get about", "At least"],
  paidCell: ["Paid to lockers", "this week"],
  risk: ["One outside risk", "3-day"],
  slider: ["4 hours", "1 year"],
  lockFor: ["Lock for", "1y"],
  slippage: ["Price protection", "Custom"],
});
await run("/launch", "launch", { firstBuyBox: ["Your first buy", "Lock part of it right away", "Time boost"], totalBox: ["Pons launch fee", "Total"] });
fs.writeFileSync(OUT, JSON.stringify(rects, null, 2));
console.log(JSON.stringify({ home: rects.home, coin: rects.coin, launch: rects.launch }));
await browser.close();
