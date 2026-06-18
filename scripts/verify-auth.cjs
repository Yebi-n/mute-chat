const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:8087/', { waitUntil: 'networkidle' });
    await page.getByText('로그인', { exact: true }).first().waitFor();
    await page.getByPlaceholder('010-0000-0000').fill('01012345678');
    await page.getByPlaceholder('비밀번호 8자 이상').fill('password123');
    await page.getByText('비밀번호를 잊으셨나요?', { exact: true }).click();
    await page.getByText('비밀번호 찾기', { exact: true }).waitFor();
    await page.getByText('로그인으로 돌아가기', { exact: true }).click();
    await page.getByText('처음이신가요? 가입하기', { exact: true }).click();
    await page.getByText('전화번호로 가입', { exact: true }).waitFor();
    console.log('Mute phone and password auth UI verified.');
  } catch (error) {
    await page.screenshot({ path: 'artifacts/auth-debug.png', fullPage: true });
    console.error('VisibleText=' + (await page.locator('body').innerText()).slice(0, 600));
    console.error('BrowserErrors=' + JSON.stringify(errors));
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
