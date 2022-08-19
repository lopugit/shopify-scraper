const siteMap = require('sitemap-crawler')
const axios = require('axios')
const { get } = require('lodash')
const puppeteer = require('puppeteer');
const { pageExtend } = require('puppeteer-jquery')
const Throttle = require('promise-parallel-throttle')
const { Timer } = require('timer-node')

const shopifyGraphApi = axios.create({
	baseURL: `https://${process.env.SHOPIFY_SHOP}.myshopify.com/admin/api/2022-10/graphql.json`,
	headers: {
		'Content-Type': 'application/json',
		'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN,
	},
})
const shopifyGraph = async body => shopifyGraphApi.post('', body)

const shopifyRestApi = axios.create({
	baseURL: `https://${process.env.SHOPIFY_SHOP}.myshopify.com/admin/api/2022-10`,
	headers: {
		'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN,
	},
})

// const { Shopify } = require('@shopify/shopify-api')

// Shopify.Context.initialize({
// 	API_KEY: process.env.SHOPIFY_API_KEY,
// 	API_SECRET_KEY: process.env.SHOPIFY_API_KEY_SECRET,
// 	SCOPES: ['access'],
// 	HOST_NAME: 'localhost',
// 	HOST_SCHEME: 'http',
// 	IS_EMBEDDED_APP: false,
// 	API_VERSION: '2021-10', // all supported versions are available, as well as "unstable" and "unversioned"
// })

const scrapeMarsHydroProducts = async () => {

	const startTime = new Date()
	const startTimeISO = startTime.toISOString().replace(/.\d+Z$/g, 'Z')
	const timer = new Timer({ label: 'mars-hydro-scrape' })
	timer.start()

	console.log('Running Scrape at', startTime)

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

	const urls = await new Promise(res => {
		siteMap('https://marshydroau.com/', (e, r) => {

			if (e) {
				console.error('error scraping sitemap', e)
			} else {
				res(r.filter(url => url.includes('/product/') || url.includes('/products/')))
			}

		})

	})

	const completedUrls = []
	const completedTitles = []
	const stats = {
		successes: 0,
		errors: 0,
		duplicates: 0,
		sameTitle: 0,
	}

	const queue = []

	const debug = {
		// url: 'https://marshydroau.com/products/60x60x140cm-indoor-grow-tent-green-dark-box-room-hydroponics-mylar-non-toxic/',
	}
	const archiveOldProducts = !debug.url

	for (let url of urls) {

		url = debug.url || url

		queue.push(async () => {

			const pageOrig = await browser.newPage()
			const page = pageExtend(pageOrig)

			try {

				const productSlug = url.replace(/\/+$/, '').split('/').pop();

				// enabled for testing of single url
				// url = 'https://marshydroau.com/products/fc-e8000-led'

				if (!completedUrls.includes(url)) {

					console.log('Scraping url', url)

					completedUrls.push(url)

					await page.goto(url, { timeout: 1000 * 99 })

					const scrapedProduct = {}

					// Get product title
					scrapedProduct.title = await page.jQuery('.product_title').text()

					if (!completedTitles.includes(scrapedProduct.title)) {

						completedTitles.push(scrapedProduct.title)

						// Get product stock level
						try {
							const rawStockLevel = await page.jQuery('.summary-inner .stock').text()
							if (rawStockLevel.toLowerCase().replace(/ /g, '').includes('outofstock')) {
								scrapedProduct.stockLevel = 0
							} else if (rawStockLevel === '') {
								scrapedProduct.stockLevel = 99
							} else {
								scrapedProduct.stockLevel = Number(rawStockLevel.split(' ')[0])
							}
						} catch {}

						// Get short description
						scrapedProduct.shortDescription = await page.jQuery('.woocommerce-product-details__short-description').text()

						await page.waitForSelector('.woocommerce-product-gallery .woocommerce-product-gallery__wrapper.owl-carousel.owl-loaded > .owl-stage-outer', { timeout: 15000 })

						// Get product images
						const images = await page.jQuery('.woocommerce-product-gallery .woocommerce-product-gallery__wrapper .owl-stage-outer > .owl-stage > .owl-item a')
							.map((id, elm) => elm)

						scrapedProduct.images = []

						for (const image of images) {
							const imageUrl = await page.evaluate(img => img.href, image)
							scrapedProduct.images.push(imageUrl)
						}

						scrapedProduct.price = await page.jQuery('.summary-inner > .price > .woocommerce-Price-amount.amount bdi').text()
						const priceReplaced = scrapedProduct.price.replace(/\$|,/g, '')
						scrapedProduct.price = Number(priceReplaced)
						scrapedProduct.price = adjustPrice(scrapedProduct.price)

						if (scrapedProduct.title && scrapedProduct.title.replace(/ /g, '').toLowerCase().includes('growkit')) {
							scrapedProduct.type = 'Grow Kit'
						} else if (scrapedProduct.title && scrapedProduct.title.replace(/ /g, '').toLowerCase().includes('growtent')) {
							scrapedProduct.type = 'Grow Tent'
						} else if (scrapedProduct.title && scrapedProduct.title.replace(/ /g, '').toLowerCase().includes('growlight')) {
							scrapedProduct.type = 'Grow Light'
						} else {
							scrapedProduct.type = 'Accessory'
						}

						const doVariants = false
						let variantOptions0
						let variantOptions1
						let variantOptions2

						if (doVariants) {

							variantOptions0 = await page.jQuery('#product-selectors-option-0')
								.find('option')

							if (variantOptions0.length) {
								scrapedProduct.variantOptions0 = {
									values: [],
								}
								scrapedProduct.variantOptions0.name = await page.jQuery('#product-variants > div:nth-child(1) > label').text()
								for (const variantOption of variantOptions0) {
									const variant = await page.evaluate(option => option.innerText, variantOption)
									scrapedProduct.variantOptions0.values.push(variant)
								}
							}

							variantOptions1 = await page.jQuery('#product-selectors-option-1')
								.find('option')

							if (variantOptions1.length) {
								scrapedProduct.variantOptions1 = {
									values: [],
								}
								scrapedProduct.variantOptions1.name = await page.jQuery('#product-variants > div:nth-child(2) > label').text()
								for (const variantOption of variantOptions1) {
									const variant = await page.evaluate(option => option.innerText, variantOption)
									scrapedProduct.variantOptions1.values.push(variant)
								}
							}

							variantOptions2 = await page.jQuery('#product-selectors-option-2')
								.find('option')

							if (variantOptions2.length) {
								scrapedProduct.variantOptions2 = {
									values: [],
								}
								scrapedProduct.variantOptions2.name = await page.jQuery('#product-variants > div:nth-child(3) > label').text()
								for (const variantOption of variantOptions2) {
									const variant = await page.evaluate(option => option.innerText, variantOption)
									scrapedProduct.variantOptions2.values.push(variant)
								}
							}
						}

						// product.longDescription = await page.jQuery('#collapse-tab1 > div').html()

						// Save to shopify
						const shopifyProduct = {}
						shopifyProduct.title = scrapedProduct.title
						shopifyProduct.body_html = scrapedProduct.shortDescription
						// shopifyProduct.body_html = product.longDescription
						shopifyProduct.vendor = 'Mars Hydro'
						shopifyProduct.product_type = scrapedProduct.type

						// shopifyProduct.images = product.images.map(image => ({
						// 	src: image,
						// }))
						shopifyProduct.images = [{ src: scrapedProduct.images[0] }]

						// Create variations

						shopifyProduct.options = []

						if (!scrapedProduct.variantOptions0) {
							scrapedProduct.variantOptions0 = {
								name: 'Default',
								values: ['Default'],
								price: scrapedProduct.price,
								quantity: scrapedProduct.stockLevel,
							}
						}

						if (scrapedProduct.variantOptions0 && scrapedProduct.variantOptions0.name !== 'Default') {
							shopifyProduct.options.push({
								...scrapedProduct.variantOptions0,
								position: 1,
							})
						}

						if (scrapedProduct.variantOptions1) {

							shopifyProduct.options.push({
								...scrapedProduct.variantOptions1,
								position: 2,
							})
						}

						if (scrapedProduct.variantOptions2) {
							shopifyProduct.options.push({
								...scrapedProduct.variantOptions2,
								position: 3,
							})
						}

						shopifyProduct.variants = []

						if (scrapedProduct.variantOptions0) {
							for (const variantOption0 of scrapedProduct.variantOptions0.values) {
								if (scrapedProduct.variantOptions1) {
									for (const variantOption1 of scrapedProduct.variantOptions1.values) {
										if (scrapedProduct.variantOptions2) {
											for (const variantOption2 of scrapedProduct.variantOptions2.values) {
												shopifyProduct.variants.push({
													option1: variantOption0,
													option2: variantOption1,
													option3: variantOption2,
													price: get(scrapedProduct.variantOptions0, 'price', 0) + get(scrapedProduct.variantOptions1, 'price', 0) + get(scrapedProduct.variantOptions2, 'price', 0),
													inventory_quantity: scrapedProduct.variantOptions0.quantity,
													inventory_management: 'shopify',
												})
											}
										} else {
											shopifyProduct.variants.push({
												option1: variantOption0,
												option2: variantOption1,
												price: get(scrapedProduct.variantOptions0, 'price', 0) + get(scrapedProduct.variantOptions1, 'price', 0),
												inventory_quantity: scrapedProduct.variantOptions0.quantity,
												inventory_management: 'shopify',
											})
										}
									}
								} else {
									shopifyProduct.variants.push({
										option1: variantOption0,
										price: get(scrapedProduct.variantOptions0, 'price', 0),
										inventory_quantity: scrapedProduct.variantOptions0.quantity,
										inventory_management: 'shopify',
									})

								}
							}
						}

						// set tags
						shopifyProduct.tags = [
							'vendor-' + shopifyProduct.vendor,
							'type-' + shopifyProduct.product_type,
							'slug-' + productSlug,
							// 'url-' + url,
						]

						shopifyProduct.tags = shopifyProduct.tags.toString()

						// check if product exists first
						// have to query for products because single product query doesn't support tags
						const productQueryResp = await shopifyGraph(
							{
								query: `{
									products(first:1, query: "tag:'slug-${productSlug}'") {
										edges {
											cursor
											node {
												id
												tags
											}
										}
									}
								}`,
							},
						)

						const products = get(productQueryResp, 'data.data.products.edges', [])

						if (products.length > 0) {
							const productId = productQueryResp.data.data.products.edges[0].node.id
							shopifyProduct.id = productId.split('/').pop()
							shopifyProduct.status = 'active'

							// for some reason options cannot be an empty array
							if (!shopifyProduct.options.length) {
								delete shopifyProduct.options
							}

							await shopifyRestApi
								.put(
									`/products/${shopifyProduct.id}.json`,
									{
										product: shopifyProduct,
									},
								)

							// update variants inventory levels

							// get product variants
							const productVariantQueryResp = await shopifyGraph(
								{
									query: `{
								productVariants(first: 100, query: "product_id:${shopifyProduct.id}") {
									edges {
										node {
											id
										}
									}
								}
							}`,
								},
							)
							const productVariants = get(productVariantQueryResp, 'data.data.productVariants.edges', [])

							// for iterating scraped variants
							let i = 0

							// loop over variants and
							for (const variant of productVariants) {
								const scrapedVariant = shopifyProduct.variants[i]
								if (scrapedVariant) {
									const scrapedInventoryLevel = scrapedVariant.inventory_quantity
									const variantInventoryItemQueryResp = await shopifyGraph(
										{
											query: `{
										productVariant(id: "${variant.node.id}") {
											inventoryItem {
												id
												inventoryLevels(first: 100) {
													edges {
														node {
															id
															available
														}
													}
												}
											}
										}
									}`,
										})

									const inventoryLevels = get(variantInventoryItemQueryResp, 'data.data.productVariant.inventoryItem.inventoryLevels.edges', [])

									for (const inventoryLevel of inventoryLevels) {
										await shopifyGraph(
											{
												query: `mutation {
											inventoryAdjustQuantity(input: {
												availableDelta: ${scrapedInventoryLevel - inventoryLevel.node.available},
												inventoryLevelId: "${inventoryLevel.node.id}"
											}) {
												inventoryLevel {
													id
												}
											}
										}`,
											},
										)
									}
								}

								i++
							}

						} else {
							await shopifyRestApi
								.post(
									'/products.json',
									{
										product: shopifyProduct,
									},
								)
						}

						console.log('Scraped url', url)
						stats.successes++
					} else {
						console.log('Product with same title already exists', scrapedProduct.title, 'url', url)
						stats.sameTitle++
					}

				} else {
					console.log('URL already scraped', url)
					stats.duplicates++
				}

			} catch (error) {
				console.error('Caught an error trying to scrape url', url, error)
				stats.errors++
			}

			console.log('Closing page for url', url)
			await pageOrig.close()
			console.log('Page closed for url', url)

			console.log('Current progress', stats.successes, '/', urls.length, 'successes', stats.errors, '/', urls.length, 'errors', stats.duplicates, '/', urls.length, 'duplicates', stats.sameTitle, '/', urls.length, 'same title')

		})

	}
	// end 	for (let url of urls) {

	// run queue in parallel
	await Throttle.all(queue, {
		maxInProgress: 8,
	})

	console.log('Finished scraping', stats.successes, 'successes and', stats.errors, 'errors and', stats.duplicates, 'duplicates and', stats.sameTitle, 'same title')

	if (archiveOldProducts) {

		console.log('Archiving old products')

		let archived = 0

		const oldProductsQueryResponse = await shopifyGraph(
			{
				query: `{
					products(first: 100, query: "tag:'vendor-Mars Hydro' AND updated_at:<'${startTimeISO}'") {
						edges {
							node {
								id
								updatedAt
							}
						}
					}
				}`,
			},
		)

		const oldProducts = get(oldProductsQueryResponse, 'data.data.products.edges', [])
		if (oldProducts.length > 0) {
			// archive all old products by this vendor
			for (const product of oldProductsQueryResponse.data.data.products.edges) {
				const productId = product.node.id

				// use shopify graphql to archive product
				await shopifyGraph(
					{
						query: `
							mutation {
								productChangeStatus(productId: "${productId}", status: ARCHIVED) {
									product {
										id
									}
									userErrors {
										field
										message
									}
								}
							}
						`,
					},
				)

				archived++

			}
		}

		console.log('Archived old products', archived, '/', oldProducts.length)
	}

	console.log('Closing browser')
	await browser.close()
	console.log('Browser closed')

	timer.pause()

	console.log('Finished Everything, Scrape Time', `${timer.format('%m m, %s s')}`)

}

module.exports = scrapeMarsHydroProducts

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
