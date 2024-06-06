import puppeteer from 'puppeteer';
import { load } from 'cheerio';
import fs from 'fs';

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const { scrollHeight } = document.body;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

async function scrapePage(page) {
  await autoScroll(page);

  const htmlData = await page.content();
  const $ = load(htmlData);
  const carInfo = [];

  $('.vehicle-card-vertical').each((index, element) => {
    const carModel =
      $(element).find('.vehicle-name__make').text().trim() +
      ' ' +
      $(element).find('.vehicle-name__year').text().trim() +
      ' ' +
      $(element).find('.vehicle-name__model').text().trim() +
      ' ' +
      $(element).find('.vehicle-name__trim').text().trim();
    const carPrice = $(element)
      .find('.vehicle-payment-cashdown__regular-price .price')
      .text()
      .trim();
    const carDetails = $(element)
      .find('.di-light-specs__list')
      .text()
      .replace(/\s\s+/g, ', ')
      .trim();
    const carStock = $(element).find('.di-stock-number').text().trim();

    if (carModel && carPrice) {
      carInfo.push({
        carModel,
        carPrice,
        carDetails,
        carStock,
      });
    }
  });

  return carInfo;
}

async function scrapeWebsite(url, outputPath) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  const allCarInfo = [];

  let hasNextPage = true;
  while (hasNextPage) {
    await page.goto(url, { waitUntil: 'networkidle2' });

    const carInfo = await scrapePage(page);
    if (carInfo.length > 0) {
      allCarInfo.push(...carInfo);
    }

    // 检查是否存在下一页按钮
    const nextPageButton = await page.$(
      '.pagination__item:not(.disabled) .simple-arrow-right',
    );
    if (nextPageButton) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        nextPageButton.click(),
      ]);
    } else {
      hasNextPage = false;
    }
  }

  await browser.close();

  const csvContent = allCarInfo
    .map(
      (car) =>
        `${car.carModel},${car.carPrice},${car.carDetails},${car.carStock}`,
    )
    .join('\n');
  fs.writeFileSync(outputPath, csvContent, 'utf8');
  console.log(`Data has been written to ${outputPath}`);
}

const website = {
  url: 'https://www.edmundstontoyota.com/en/new-inventory',
  output: 'carInfo_edmundston.csv',
};

(async () => {
  await scrapeWebsite(website.url, website.output);
})().catch((err) => console.error(err));
