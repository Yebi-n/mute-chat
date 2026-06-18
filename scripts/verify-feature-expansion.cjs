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
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:8091', { waitUntil: 'networkidle' });

    const roomMenu = page.getByLabel('초록 테이블 채팅방 메뉴').first();
    await roomMenu.dispatchEvent('pointerdown');
    await page.waitForTimeout(550);
    await roomMenu.dispatchEvent('pointerup');

    await page.getByText('스토리', { exact: true }).last().click();
    if (await page.getByText('전체 공개 글 · 최신순').count()) {
      throw new Error('삭제된 공개 스토리 설명 헤더가 남아 있습니다.');
    }

    await page.getByText('내 채팅', { exact: true }).last().click();
    await page.getByText('초록 테이블', { exact: true }).first().click();
    await page.getByLabel('채팅 검색').click();
    await page.getByPlaceholder('이 방의 채팅 검색').fill('산책');
    await page.getByText('2건').waitFor();
    await page.getByLabel('채팅 검색').click();

    await page.getByText('전체보기', { exact: true }).click();
    await page.getByText('접기', { exact: true }).waitFor();

    const longMessage = page.getByText(/산책 코스는 지난번에 갔던 공원/);
    await longMessage.click({ button: 'right' }).catch(() => undefined);

    await page.getByLabel('add').click();
    await page.getByText('카메라', { exact: true }).waitFor();
    await page.getByText('갤러리', { exact: true }).waitFor();

    console.log('Mute feature expansion scenarios verified.');
  } catch (error) {
    console.error('VisibleText=' + (await page.locator('body').innerText()).slice(0, 800));
    console.error('BrowserErrors=' + JSON.stringify(errors));
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
