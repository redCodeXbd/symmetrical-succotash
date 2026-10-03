#!/usr/bin/env node
/**
 * Takes the screenshots used by the Help guides and measures where each step points.
 *
 *   1. Start the app:            npx ng serve --port 4300
 *   2. Run:                      node tools/help-capture.js            (all guides)
 *                                node tools/help-capture.js expense-quick-entry   (one guide)
 *
 * Input:  src/app/modules/admin/help/help-guides.json  (each shot lists the actions to reach a screen, and each step a "target")
 * Output: public/images/help/<guide>-<shot>.jpg  and  src/app/modules/admin/help/help-pins.json
 *
 * Actions: {"as":"Name"} act as a user · {"nav":["Treasury","Funds","All requests"]} click menu items, one per level · {"goto":"/path"} open an address · {"click":sel} · {"fill":[sel,text]}
 *          {"select":[sel,value]} · {"press":[sel,key]} · {"wait":ms} · {"hover":sel}.  Selectors are Playwright selectors.
 * Re-run it after screens change so the pictures and pointers stay current.
 */
const fs = require('fs');
const path = require('path');

let playwright;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { playwright = require(p); break; } catch { /* try the next */ }
}
if (!playwright) { console.error('Playwright is not installed.'); process.exit(1); }

const ROOT = path.join(__dirname, '..');
const GUIDES = path.join(ROOT, 'src/app/modules/admin/help/help-guides.json');
const PINS = path.join(ROOT, 'src/app/modules/admin/help/help-pins.json');
const OUT = path.join(ROOT, 'public/images/help');
const BASE = process.env.HELP_BASE_URL || 'http://localhost:4300';
const VIEW = { width: 1280, height: 760 };
const only = process.argv[2];

const guides = JSON.parse(fs.readFileSync(GUIDES, 'utf8')).filter((g) => !only || g.id === only);
const pins = fs.existsSync(PINS) ? JSON.parse(fs.readFileSync(PINS, 'utf8')) : {};
fs.mkdirSync(OUT, { recursive: true });

async function run(page, a) {
    if (a.as) {
        await page.locator('a.app-sidebar-user').click();
        await page.waitForTimeout(700);
        await page.locator('select.user-switch-select').selectOption({ label: a.as });
        await page.waitForTimeout(500);
    } else if (a.nav) {
        for (const title of [].concat(a.nav)) {
            // Only items that are showing: the menu has three levels and some titles repeat in closed groups.
            const item = page.locator('.fuse-vertical-navigation-item-title:visible', { hasText: new RegExp(`^\\s*${title}\\s*$`) }).first();
            await item.click();
            await page.waitForTimeout(700);
        }
    } else if (a.goto) {
        // Open an address inside the app without reloading it (keeps the demo data and the acting user).
        await page.evaluate((url) => {
            history.pushState({}, '', url);
            dispatchEvent(new PopStateEvent('popstate'));
        }, a.goto);
        await page.waitForTimeout(900);
    } else if (a.click) {
        await page.locator(a.click).first().click();
        await page.waitForTimeout(400);
    } else if (a.fill) {
        await page.locator(a.fill[0]).first().fill(a.fill[1]);
    } else if (a.select) {
        await page.locator(a.select[0]).first().selectOption(a.select[1]);
        await page.waitForTimeout(300);
    } else if (a.press) {
        await page.locator(a.press[0]).first().press(a.press[1]);
        await page.waitForTimeout(400);
    } else if (a.hover) {
        await page.locator(a.hover).first().hover();
    } else if (a.wait) {
        await page.waitForTimeout(a.wait);
    }
}

(async () => {
    const browser = await playwright.chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
    let problems = 0;
    for (const guide of guides) {
        for (const shot of guide.shots) {
            const ctx = await browser.newContext({ viewport: VIEW });
            const page = await ctx.newPage();
            page.setDefaultTimeout(6000);
            const key = `${guide.id}.${shot.id}`;
            try {
                await page.goto(`${BASE}/sign-in`);
                await page.waitForTimeout(1000);
                await page.click('button[type=submit]');
                await page.waitForTimeout(2200);
                if (shot.capture.as) { await run(page, { as: shot.capture.as }); }
                for (const a of shot.capture.actions || []) { await run(page, a); }
                await page.waitForTimeout(shot.capture.wait ?? 500);
                await page.screenshot({ path: path.join(OUT, `${guide.id}-${shot.id}.jpg`), type: 'jpeg', quality: 62 });
                const list = [];
                for (const [i, step] of shot.steps.entries()) {
                    let pin = null;
                    if (step.target) {
                        const loc = page.locator(step.target).first();
                        if (await loc.count()) {
                            const b = await loc.boundingBox();
                            if (b && b.y < VIEW.height && b.y + b.height > 0) {
                                const pct = (v, t) => Math.round((v / t) * 1000) / 10;
                                const y = Math.max(b.y, 0);
                                pin = { x: pct(b.x, VIEW.width), y: pct(y, VIEW.height), w: pct(Math.min(b.width, VIEW.width - b.x), VIEW.width), h: pct(Math.min(b.height, VIEW.height - y), VIEW.height) };
                            }
                        }
                        if (!pin) { console.warn(`  ! ${key} step ${i + 1}: target not visible: ${step.target}`); problems++; }
                    }
                    list.push(pin);
                }
                pins[key] = list;
                console.log(`ok  ${key}`);
            } catch (e) {
                console.warn(`ERR ${key}: ${String(e.message).split('\n')[0]}`);
                problems++;
            } finally {
                await ctx.close();
            }
        }
    }
    fs.writeFileSync(PINS, JSON.stringify(pins, null, 2) + '\n');
    await browser.close();
    console.log(problems ? `Done with ${problems} problem(s).` : 'Done.');
})();
