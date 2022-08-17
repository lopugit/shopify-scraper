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
const puppeteer = require('puppeteer');
const { pageExtend } = require('puppeteer-jquery');
// Const { jq } = require('jquery')

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

		console.log('Found product sitemap', productSitemapUrl)

		const productSitemapResp = await axios.get(productSitemapUrl).catch(console.error)

		const productsSitemapXML = get(productSitemapResp, 'data')
		const productsSitemapJson = convert.xml2json(productsSitemapXML, { compact: true, spaces: 4 })
		const products = JSON.parse(productsSitemapJson).urlset.url

		// Products.forEach(product => {
		// 	console.log(product)
		// 	c.queue({ uri: product.loc._text, callback: scrapeProductFromPage })
		// })

		const url = 'https://marshydroau.com/collections/grow-tent/products/150x150x200cm-portable-grow-tent-silver-mylar-hydroponic-dark-green-room'
		await page.goto(url, { timeout: 1000 * 15 })

		const productXML = products[3]
		const product = {}

		// Get product title
		product.title = await page.jQuery('#shopify-section-product-template > div.product.tab-horizontal > div > div.col-md-6.col-lg-12.col-xl-12.product-shop.vertical > header > h2 > span').text()

		// Get product stock level
		product.stockLevel = await page.jQuery('#shopify-section-product-template > div.product.tab-horizontal > div > div.col-md-6.col-lg-12.col-xl-12.product-shop.vertical > div.product-infor > div > span').text()

		// Get short description
		product.shortDescription = await page.jQuery('#shopify-section-product-template > div.product.tab-horizontal > div > div.col-md-6.col-lg-12.col-xl-12.product-shop.vertical > div:nth-child(6) > div').text()

		await page.waitForSelector('#shopify-section-product-template > div.product.tab-horizontal > div > div.col-md-6.col-lg-12.col-xl-12.product-img-box.vertical > div.contain-images-pr > div.productView-nav-wrapper.vertical > div > div > div', { timeout: 5000 })

		// Get product images
		let jQuery
		const images = await page.jQuery('#shopify-section-product-template > div.product.tab-horizontal > div > div.col-md-6.col-lg-12.col-xl-12.product-img-box.vertical > div.contain-images-pr > div.productView-nav-wrapper.vertical > div > div > div a.fancybox')
			.map(elm => {
				console.log(elm)
				const div = jQuery(elm)
				return elm
			})
		// .find('a.fancybox')
		product.images = []

		for (const image of images) {
			const imageUrl = await page.evaluate(img => img.href, image)
			product.images.push(imageUrl)
		}

		product.price = await page.jQuery('#add-to-cart-form > div.prices > span > span').text()
		product.price = Number(product.price.replace('$', ''))
		product.price = adjustPrice(product.price)

		const variant0Options = await page.jQuery('#product-selectors-option-0')
			.find('option')

		if (variant0Options.length) {
			product.variantOptions0 = {
				values: [],
			}
			product.variantOptions0.name = await page.jQuery('#product-variants > div:nth-child(1) > label').text()
			for (const variantOption of variant0Options) {
				const variant = await page.evaluate(option => option.innerText, variantOption)
				product.variantOptions0.values.push(variant)
			}
		}

		const variant1Options = await page.jQuery('#product-selectors-option-1')
			.find('option')

		if (variant1Options.length) {
			product.variantOptions1 = {
				values: [],
			}
			product.variantOptions1.name = await page.jQuery('#product-variants > div:nth-child(2) > label').text()
			for (const variantOption of variant1Options) {
				const variant = await page.evaluate(option => option.innerText, variantOption)
				product.variantOptions1.values.push(variant)
			}
		}

		const variant2Options = await page.jQuery('#product-selectors-option-2')
			.find('option')

		if (variant2Options.length) {
			product.variantOptions2 = {
				values: [],
			}
			product.variantOptions2.name = await page.jQuery('#product-variants > div:nth-child(3) > label').text()
			for (const variantOption of variant2Options) {
				const variant = await page.evaluate(option => option.innerText, variantOption)
				product.variantOptions2.values.push(variant)
			}
		}

		product.longDescription = await page.jQuery('#collapse-tab1 > div').html()

		// Save to shopify
		const shopifyProduct = {}
		shopifyProduct.title = product.title
		shopifyProduct.body_html = product.longDescription
		shopifyProduct.vendor = 'Mars Hydro'

		// Create product type
		const imageTitle = get(productXML, 'image:image.image:title._text', '')
		if (imageTitle && imageTitle.replace(' ', '').toLowerCase().includes('growkit')) {
			shopifyProduct.product_type = 'Grow Kit'
		} else if (imageTitle && imageTitle.replace(' ', '').toLowerCase().includes('growtent')) {
			shopifyProduct.product_type = 'Grow Tent'
		} else if (imageTitle && imageTitle.replace(' ', '').toLowerCase().includes('growlight')) {
			shopifyProduct.product_type = 'Grow Light'
		} else {
			shopifyProduct.product_type = 'Accessory'
		}

		// Create variations

		shopifyProduct.options = []

		if (product.variantOptions0) {

			shopifyProduct.options.push({
				name: product.variantOptions0.name,
				values: product.variantOptions0.values,
				position: 1,
			})
		}

		if (product.variantOptions1) {

			shopifyProduct.options.push({
				name: product.variantOptions1.name,
				values: product.variantOptions1.values,
				position: 2,
			})
		}

		if (product.variantOptions2) {
			shopifyProduct.options.push({
				name: product.variantOptions2.name,
				values: product.variantOptions2.values,
				position: 2,
			})
		}

		shopifyProduct.variants = []

		if (product.variantOptions0) {
			for (const variantOption0 of product.variantOptions0.values) {
				if (product.variantOptions1) {
					for (const variantOption1 of product.variantOptions1.values) {
						if (product.variantOptions2) {
							for (const variantOption2 of product.variantOptions2.values) {
								shopifyProduct.variants.push({
									option1: variantOption0,
									option2: variantOption1,
									option3: variantOption2,
								})
							}
						} else {
							shopifyProduct.variants.push({
								option1: variantOption0,
								option2: variantOption1,
							})
						}
					}
				} else {
					shopifyProduct.variants.push({
						option1: variantOption0,
					})

				}
			}
		}

		if (!product.variantOptions0) {
			const productResponse = await axios
				.post(
					`https://${process.env.SHOPIFY_SHOP}.myshopify.com/admin/api/2022-01/products.json`,
					{
						product: shopifyProduct,
					},
					{
						headers: {
							'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN,
						},
					},
				)
				.catch(err =>
					console.error('Found error in shopify response', err.response.data),
				)
		}

		console.log('done')

	}

	scrapeMarsHydro()
	setInterval(scrapeMarsHydro, 1000 * 60 * 60)
})()

function adjustPrice(price) {
	let factor = 1.2
	if (price < 20) {
		factor = 1.39
	} else if (price < 30) {
		factor = 1.35
	} else if (price < 40) {
		factor = 1.32
	} else if (price < 60) {
		factor = 1.25
	} else if (price < 80) {
		factor = 1.20
	} else if (price < 200) {
		factor = 1.18
	} else if (price < 400) {
		factor = 1.16
	} else if (price < 500) {
		factor = 1.15
	} else if (price < 600) {
		factor = 1.15
	} else if (price < 800) {
		factor = 1.14
	} else if (price < 900) {
		factor = 1.125
	} else if (price < 1100) {
		factor = 1.12
	} else if (price < 1200) {
		factor = 1.1
	} else if (price < 1300) {
		factor = 1.09
	} else if (price < 1400) {
		factor = 1.08
	} else if (price < 1500) {
		factor = 1.07
	} else if (price < 1600) {
		factor = 1.06
	} else if (price < 1700) {
		factor = 1.057
	} else if (price < 1900) {
		factor = 1.055
	} else if (price < 2000) {
		factor = 1.052
	} else if (price >= 2000) {
		factor = 1.05
	}

	let value = price * factor

	// Round the value to the nearest 5 or 9 dollar increment
	if (value < 10) {
		value = Math.ceil(value)
	} else if (value % 10 < 5) {
		value = Math.round(value / 10) * 10
	} else if (value % 10 === 5) {
		value = (Math.round(value / 10) * 10) - 5
	} else {
		value = (Math.round(value / 10) * 10) - 1
	}

	return value

}
