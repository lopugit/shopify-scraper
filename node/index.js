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

const convert = require('xml-js')
const crawler = require('crawler')
const c = new crawler({
	maxConnections: 10,
	userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36',
})

const scrapeMarsHydro = async () => {

	console.log('Running Scrape at', new Date())

	const sitemapMainResp = await axios.get('https://marshydroau.com/sitemap.xml').catch(console.error)

	if (!sitemapMainResp) {
		return
	}

	const sitemapMain = JSON.parse(convert.xml2json(get(sitemapMainResp, 'data'), { compact: true, spaces: 4 }))

	const productSitemapUrl = sitemapMain.sitemapindex.sitemap.find(url => {
		if (url.loc._text.includes('sitemap_products')) {
			return true
		}

		return false
	}).loc._text

	console.log(productSitemapUrl)

	const productSitemapResp = await axios.get(productSitemapUrl).catch(console.error)

	const productsSitemapXML = get(productSitemapResp, 'data')
	const productsSitemapJson = convert.xml2json(productsSitemapXML, { compact: true, spaces: 4 })
	const products = JSON.parse(productsSitemapJson).urlset.url

	// Products.forEach(product => {
	// 	console.log(product)
	// 	c.queue({ uri: product.loc._text, callback: scrapeProductFromPage })
	// })

	c.queue({ uri: 'https://marshydroau.com/products/mars-hydro-4-6-inch-inline-fan-carbon-filter-ventilation-grow-kits-for-grow-room', callback: scrapeProductFromPage })

}

const marsHydroProductSchema = [
	{
		name: 'title',
		selector: '#shopify-section-product-template > div.product.tab-horizontal > div > div.col-md-6.col-lg-12.col-xl-12.product-shop.vertical > header > h2 > span',
		crawler: 'text',
	},
	{
		name: 'availability',
		selector: '#shopify-section-product-template > div.product.tab-horizontal > div > div.col-md-6.col-lg-12.col-xl-12.product-shop.vertical > div.product-infor > div > span',
		crawler: 'text',
		modify(value) {
			return value.replace(/\\n/gi, '').trim()
		}
	},
]

const scrapeProductFromPage = async (error, res, done) => {

	if (error) {
		console.error(error)
		return
	}

	const { $ } = res

	const product = {}

	for (const property of marsHydroProductSchema) {
		product[property.name] = $(property.selector)[property.crawler]()
		if (property.modify) {
			product[property.name] = property.modify(product[property.name])
		}
	}

	console.log(product)

	// Save product to shopify api

	done()
}

scrapeMarsHydro()
setInterval(scrapeMarsHydro, 1000 * 60 * 60)
