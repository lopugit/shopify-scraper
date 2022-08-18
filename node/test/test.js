const puppeteer = require('puppeteer');

const { pageExtend } = require('puppeteer-jquery');

const pc = require('picocolors');

let jQuery;

(async () => {

	const browser = await puppeteer.launch({ headless: true,
		args: [
			'--unlimited-storage',
			'--full-memory-crash-report',
			'--disable-gpu',
			'--ignore-certificate-errors',
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-dev-shm-usage',
			'--lang=en-US;q=0.9,en;q=0.8',
			'--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36',
		],
	});

	const pageOrg = await browser.newPage();

	await pageOrg.goto('https://github.com/UrielCh/puppeteer-jquery', { waitUntil: 'networkidle2' });

	const jqPage = pageExtend(pageOrg);

	/** @type {string} */

	const stars = await jqPage.jQuery('#repo-stars-counter-star').text();

	console.log(`my project is only ${pc.yellow(stars)}⭐`);

	const files = await jqPage.jQuery('div[aria-labelledby="files"] > div[role="row"].Box-row')
		.map((id, elm) => {

			console.log('hey')

			const div = jQuery(elm);

			const icon = (div.find('[role="gridcell"] [aria-label]:first').attr('aria-label') || '').trim();

			const filename = (div.find('div[role="rowheader"]').text() || '').trim();

			const lastChange = (div.find('[role="gridcell"]:last').text() || '').trim();

			return { icon, filename, lastChange };

		}).pojo();

	for (const file of files) {

		console.log(`file ${pc.green(file.filename)} is ${file.icon} had been change ${file.lastChange} `);

	}

	browser.close()

})();
