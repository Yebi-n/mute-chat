const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:8091', { waitUntil: 'networkidle' });

  await page.getByText('홈', { exact: true }).click();
  await page.getByText('프로모션', { exact: true }).click();
  if (!(await page.getByText('랭킹', { exact: true }).count())) throw new Error('Promotion ranking is missing.');
  await page.getByText('콘셉트', { exact: true }).click();
  if (await page.getByText('랭킹', { exact: true }).count()) throw new Error('Ranking must only appear in Promotion.');

  await page.getByLabel('검색').click();
  if (await page.getByText('초록 테이블', { exact: true }).count()) throw new Error('Search must be empty before input.');
  await page.getByPlaceholder('방 이름, 설명, 해시태그 검색').fill('수원');
  if (!(await page.getByText('수원 저녁 산책', { exact: true }).count())) throw new Error('Search result is missing.');
  await page.getByText('수원 저녁 산책', { exact: true }).click();
  await page.screenshot({ path: 'artifacts/room-detail-updated.png', fullPage: true });
  if (!(await page.getByText('가입 신청하기', { exact: true }).count())) throw new Error('Join CTA is missing.');
  await page.getByText('초록윤', { exact: true }).first().click();
  if (!(await page.getByText('자기 소개', { exact: true }).count())) throw new Error('Member profile page is missing.');
  await page.getByLabel('chevron-back').click();
  await page.getByLabel('chevron-back').click();

  await page.getByText('내 채팅', { exact: true }).click();
  await page.getByText('초록 테이블', { exact: true }).first().click();
  if (!(await page.getByText('여기까지 읽었어요', { exact: true }).count())) throw new Error('Unread marker is missing.');
  await page.getByLabel('add').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/chat-plus-menu.png', fullPage: true });
  await page.getByText('탑스페이스', { exact: true }).click();
  await page.getByLabel('500 포인트 1시간').click();
  await page.getByText('500 P로 올리기', { exact: true }).click();
  await page.getByLabel('탑스페이스 닫기').click({ position: { x: 10, y: 10 } });

  await page.getByLabel('menu').click();
  await page.getByText('가입 신청 목록', { exact: true }).click();
  if (!(await page.getByText('승인', { exact: true }).count())) throw new Error('Join request actions are missing.');
  await page.screenshot({ path: 'artifacts/join-requests.png', fullPage: true });
  await page.getByLabel('chevron-back').click();
  await page.getByLabel('menu').click();
  await page.getByText('멤버 및 스토리', { exact: true }).click();
  await page.screenshot({ path: 'artifacts/member-story-overview.png', fullPage: true });

  console.log('Mute requested UX scenarios verified.');
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
