// Render pages (HTML strings) to PNG at 2x with headless Chrome, then downscale to final size.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib.mjs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export async function renderAll(pages, only = []) {
  const todo = only.length ? pages.filter((p) => only.some((o) => p.out.includes(o))) : pages;
  const work = path.join(ROOT, 'work');
  fs.mkdirSync(path.join(work, 'html'), { recursive: true });
  fs.mkdirSync(path.join(work, 'raw'), { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'clasp-gfx-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, userDataDir: profile,
    args: ['--allow-file-access-from-files', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--font-render-hinting=none'],
  });
  const jobs = [];
  try {
    const page = await browser.newPage();
    for (const p of todo) {
      const base = path.basename(p.out, '.png');
      const htmlFile = path.join(work, 'html', `${p.group || 'x'}-${base}.html`);
      fs.writeFileSync(htmlFile, p.html);
      await page.setViewport({ width: p.w, height: p.h, deviceScaleFactor: 2 });
      await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
      // Overflow check: report elements spilling outside the frame.
      const warn = await page.evaluate((W, H) => {
        const bad = [];
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > W + 1 || r.bottom > H + 1) && !el.closest('.shot')) bad.push(`${el.tagName}.${el.className?.baseVal ?? el.className} ${Math.round(r.right)}x${Math.round(r.bottom)}`);
          if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow === 'hidden' && !el.classList.contains('shot') && !el.closest('.shot')) bad.push(`clip ${el.tagName}.${el.className}`);
        }
        return bad.slice(0, 6);
      }, p.w, p.h);
      if (warn.length) console.log(`  ! ${base}: ${warn.join(' | ')}`);
      const raw = path.join(work, 'raw', `${p.group || 'x'}-${base}@2x.png`);
      await page.screenshot({ path: raw, clip: { x: 0, y: 0, width: p.w, height: p.h } });
      jobs.push([raw, p.out, p.w, p.h]);
      console.log(`rendered ${p.out}`);
    }
  } finally {
    await browser.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
  const list = path.join(work, 'jobs.json');
  fs.writeFileSync(list, JSON.stringify(jobs));
  execFileSync('python', [path.join(ROOT, 'downscale.py'), list], { stdio: 'inherit' });
}
