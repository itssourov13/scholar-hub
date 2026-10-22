import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("console", msg => console.log("BROWSER CONSOLE:", msg.type(), msg.text()));
  page.on("pageerror", err => console.log("BROWSER PAGEERROR:", err.message));
  
  await page.goto("http://localhost:3001/");
  await page.waitForTimeout(2000);
  console.log("Page loaded");
  await browser.close();
}
run();
