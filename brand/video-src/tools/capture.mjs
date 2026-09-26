// Headless capture of public clasp.fun UI states + element rects.
// Own temp profile; never attaches to a user browser; no login.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const OUT = "C:/tech/Clasp/brand/video-src/public/ui";
const PROFILE = "C:/tech/Clasp/brand/x/video/work/chrome-profile";
const COIN = "/coins/0x1fFBca055F0f0d1c5F81b456540DF1f395D9E173";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PROFILE, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  userDataDir: PROFILE,
  args: ["--no-first-run", "--no-default-browser-check", "--hide-scrollbars"],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rects = {};

async function open(url, dpr) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: dpr });
  await page.goto("https://clasp.fun" + url, { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(2000);
  // Freeze caret blink/animations for stable frames.
  await page.addStyleTag({ content: "*{caret-color:transparent!important;transition:none!important;animation-play-state:paused!important}" });
  return page;
}

// Find element rects (CSS px, page coords) by visible text, optionally climbing to an ancestor of min width.
async function rectOf(page, { text, tag = "*", exact = true, climb = 0, minW = 0 }) {
  return page.evaluate(({ text, tag, exact, climb, minW }) => {
    const all = [...document.querySelectorAll(tag)];
    const hit = all.find((el) => {
      const t = (el.innerText || el.value || el.placeholder || "").trim();
      if (!t) return false;
      if (exact ? t !== text : !t.startsWith(text)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!hit) return null;
    let el = hit;
    for (let i = 0; i < climb; i++) el = el.parentElement;
    while (minW && el.getBoundingClientRect().width < minW && el.parentElement) el = el.parentElement;
    const r = el.getBoundingClientRect();
    return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
  }, { text, tag, exact, climb, minW });
}
async function collect(page, key, specs) {
  rects[key] = rects[key] || {};
  for (const [name, spec] of Object.entries(specs)) {
    const r = await rectOf(page, spec);
    if (!r) console.warn("missing rect", key, name);
    rects[key][name] = r;
  }
}

// ---------- Home ----------
{
  const page = await open("/", 2);
  await page.screenshot({ path: path.join(OUT, "home.png") });
  await collect(page, "home", {
    badge: { text: "On Robinhood Chain · paid in ETH", exact: false, minW: 250 },
    h1: { text: "Lock a coin", tag: "h1", exact: false },
    browse: { text: "Browse coins", tag: "a" },
    launch: { text: "Launch a coin", tag: "a" },
    navCoins: { text: "Coins", tag: "a" },
    signin: { text: "Sign in", tag: "button" },
  });
  // Sign-in dialog
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Sign in").click());
  await sleep(1200);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, "signin.png") });
  await collect(page, "signin", {
    title: { text: "Sign in to Clasp", exact: true },
    google: { text: "Continue with Google", tag: "button", exact: false },
    googleNote: { text: "Clasp creates a wallet", exact: false },
    walletHead: { text: "OR USE YOUR OWN WALLET", exact: false },
    walletNote: { text: "With your own wallet, Clasp never sees your keys", exact: false },
    dialog: { text: "Sign in to Clasp", exact: true, minW: 400 },
  });
  await page.close();
}

// ---------- Coin page ----------
{
  const page = await open(COIN, 2);
  await page.screenshot({ path: path.join(OUT, "coin.png"), fullPage: true });
  await collect(page, "coin", {
    title: { text: "Clasp Test", tag: "h1" },
    stats: { text: "Price", exact: true, minW: 1000 },
    paid: { text: "Paid to lockers", exact: true, minW: 120 },
    banner: { text: "Pull it in", tag: "button", minW: 1000 },
    lockCard: { text: "Lock $CLTEST", exact: true, minW: 500 },
    input: { text: "CLTEST", exact: true, minW: 400 },
    chip4h: { text: "4h", tag: "button" },
    chip1w: { text: "1w", tag: "button" },
    chip1y: { text: "1y", tag: "button" },
    boost: { text: "Your boost", exact: true, minW: 500 },
    lockBtn: { text: "Sign in to lock", tag: "button" },
    tradeCard: { text: "Trade", exact: true, minW: 500 },
    tradeNote: { text: "Trades here pay a 2% fee", exact: false },
    feeRows: { text: "Clasp fee (2%)", exact: true, minW: 500 },
    buyBtn: { text: "Sign in to buy", tag: "button" },
    rules: { text: "This vault’s rules", exact: false, minW: 500 },
    risk: { text: "One outside risk:", exact: false, minW: 500 },
  });
  const lock = rects.coin.lockCard;
  const clip = { x: lock.x - 12, y: lock.y - 12, width: lock.w + 24, height: lock.h + 24 };
  rects.coin.lockClip = { x: clip.x, y: clip.y, w: clip.width, h: clip.height };
  const shotLock = async (name) => {
    await page.screenshot({ path: path.join(OUT, name), clip: { ...clip, scale: 1.5 } });
    console.log("saved", name);
  };
  const chip = async (label) => {
    await page.evaluate((label) => [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === label).click(), label);
    await sleep(500);
  };
  await shotLock("lock-0-1y.png");
  await chip("1w");
  await shotLock("lock-0-1w.png");
  await chip("1y");
  // Typing sequence (1y default)
  const input = await page.$("input[placeholder='0']");
  await input.click();
  const amount = "1000000";
  for (let i = 1; i <= amount.length; i++) {
    await page.keyboard.type(amount[i - 1]);
    await sleep(250);
    await shotLock(`lock-t${i}-1y.png`);
  }
  await chip("1w");
  await shotLock("lock-t7-1w.png");
  await chip("1y");
  await shotLock("lock-t7-1y-b.png");
  await page.close();
}

// ---------- Launch page ----------
{
  const page = await open("/launch", 2);
  await page.screenshot({ path: path.join(OUT, "launch.png"), fullPage: true });
  await collect(page, "launch", {
    h1: { text: "Launch a coin that pays its holders", exact: true },
    form: { text: "Name", exact: true, minW: 700 },
    name: { text: "Name", exact: true },
    firstBuy: { text: "Your first buy", exact: true, minW: 600 },
    lockPart: { text: "Lock part of it right away", exact: true },
    rules: { text: "Your coin’s vault will get these rules", exact: false, minW: 600 },
    total: { text: "Total", exact: true, minW: 600 },
    launchBtn: { text: "Sign in to launch", tag: "button" },
  });
  await page.close();
}

fs.writeFileSync(path.join(OUT, "rects.json"), JSON.stringify(rects, null, 2));
console.log(JSON.stringify(rects, null, 1));
await browser.close();
