// Catches all uncaught errors so process never dies
process.on('uncaughtException', err => {
	console.log('Caught exception: ', err);
});

require('dotenv').config()
const bodyParser = require('body-parser')
const express = require('express')
const cors = require('cors')
const app = express()
app.use(bodyParser.json())
const port = process.env.PORT
const axios = require('axios')
const pug = require('pug')
const { DateTime } = require('luxon')
const bcrypt = require('bcrypt')
const saltRounds = 10
const { get } = require('lodash')
const siteMap = require('sitemap-crawler')

// Express middleware
app.use(cors({
	origin: '*',
}))

app.get('/', (req, res) => {
	res.status(200).send('Hello YT World!')
})

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`)
})

// Keep self alive
setInterval(() => {
	axios.get('https://shopify-scraper.herokuapp.com').then(r => {
		console.log(r)
	}).catch(e => {
		console.log(e)
	})
}, 5 * 60 * 1000)

const puppeteer = require('puppeteer');
const { pageExtend } = require('puppeteer-jquery')
const scrapeMarsHydroProducts = require('sites/marsHydro');

(async () => {

	const browser = await puppeteer.launch({
		headless: true,
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
	})

	const pageOrg = await browser.newPage()
	const page = pageExtend(pageOrg)

	scrapeMarsHydroProducts(page)
	setInterval(() => scrapeMarsHydroProducts(page), 1000 * 60 * 60)

})()

