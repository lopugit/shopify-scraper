const siteMap = require('sitemap-crawler')
const axios = require('axios')
const { get } = require('lodash')
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

const scrapeMarsHydroProducts = async page => {

	console.log('Running Scrape at', new Date())

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

	for (let url of urls) {
		url = urls[0]

		if (!completedUrls.includes(url)) {

			console.log('Scraping url', url)

			completedUrls.push(url)

			await page.goto(url, { timeout: 1000 * 15 })

			const product = {}

			// Get product title
			product.title = await page.jQuery('.product_title').text()

			// Get product stock level
			try {
				const rawStockLevel = await page.jQuery('.summary-inner .stock').text()
				product.stockLevel = Number(rawStockLevel.split(' ')[0])
			} catch {}

			// Get short description
			product.shortDescription = await page.jQuery('.woocommerce-product-details__short-description').text()

			await page.waitForSelector('.woocommerce-product-gallery .woocommerce-product-gallery__wrapper.owl-carousel.owl-loaded > .owl-stage-outer', { timeout: 5000 })

			// Get product images
			const images = await page.jQuery('.woocommerce-product-gallery .woocommerce-product-gallery__wrapper .owl-stage-outer > .owl-stage > .owl-item a')
				.map((id, elm) => elm)
			// .find('a.fancybox')
			product.images = []

			for (const image of images) {
				const imageUrl = await page.evaluate(img => img.href, image)
				product.images.push(imageUrl)
			}

			product.price = await page.jQuery('.summary-inner > .price > .woocommerce-Price-amount.amount bdi').text()
			product.price = Number(product.price.replace('$', ''))
			product.price = adjustPrice(product.price)

			if (product.title && product.title.replace(/ /g, '').toLowerCase().includes('growkit')) {
				product.type = 'Grow Kit'
			} else if (product.title && product.title.replace(/ /g, '').toLowerCase().includes('growtent')) {
				product.type = 'Grow Tent'
			} else if (product.title && product.title.replace(/ /g, '').toLowerCase().includes('growlight')) {
				product.type = 'Grow Light'
			} else {
				product.type = 'Accessory'
			}

			const doVariants = false
			let variantOptions0
			let variantOptions1
			let variantOptions2

			if (doVariants) {

				variantOptions0 = await page.jQuery('#product-selectors-option-0')
					.find('option')

				if (variantOptions0.length) {
					product.variantOptions0 = {
						values: [],
					}
					product.variantOptions0.name = await page.jQuery('#product-variants > div:nth-child(1) > label').text()
					for (const variantOption of variantOptions0) {
						const variant = await page.evaluate(option => option.innerText, variantOption)
						product.variantOptions0.values.push(variant)
					}
				}

				variantOptions1 = await page.jQuery('#product-selectors-option-1')
					.find('option')

				if (variantOptions1.length) {
					product.variantOptions1 = {
						values: [],
					}
					product.variantOptions1.name = await page.jQuery('#product-variants > div:nth-child(2) > label').text()
					for (const variantOption of variantOptions1) {
						const variant = await page.evaluate(option => option.innerText, variantOption)
						product.variantOptions1.values.push(variant)
					}
				}

				variantOptions2 = await page.jQuery('#product-selectors-option-2')
					.find('option')

				if (variantOptions2.length) {
					product.variantOptions2 = {
						values: [],
					}
					product.variantOptions2.name = await page.jQuery('#product-variants > div:nth-child(3) > label').text()
					for (const variantOption of variantOptions2) {
						const variant = await page.evaluate(option => option.innerText, variantOption)
						product.variantOptions2.values.push(variant)
					}
				}
			}

			// product.longDescription = await page.jQuery('#collapse-tab1 > div').html()

			// Save to shopify
			const shopifyProduct = {}
			shopifyProduct.title = product.title
			shopifyProduct.body_html = product.shortDescription
			// shopifyProduct.body_html = product.longDescription
			shopifyProduct.vendor = 'Mars Hydro'
			shopifyProduct.product_type = product.type

			// shopifyProduct.images = product.images.map(image => ({
			// 	src: image,
			// }))
			shopifyProduct.images = [{ src: product.images[0] }]

			// Create variations

			shopifyProduct.options = []

			if (!product.variantOptions0) {
				product.variantOptions0 = {
					name: 'Default',
					values: ['Default'],
					price: product.price,
					quantity: product.stockLevel,
				}
			}

			if (product.variantOptions0 && product.variantOptions0.name !== 'Default') {
				shopifyProduct.options.push({
					...product.variantOptions0,
					position: 1,
				})
			}

			if (product.variantOptions1) {

				shopifyProduct.options.push({
					...product.variantOptions1,
					position: 2,
				})
			}

			if (product.variantOptions2) {
				shopifyProduct.options.push({
					...product.variantOptions2,
					position: 3,
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
										price: get(product.variantOptions0, 'price', 0) + get(product.variantOptions1, 'price', 0) + get(product.variantOptions2, 'price', 0),
										inventory_quantity: product.variantOptions0.quantity,
										inventory_management: 'shopify',
									})
								}
							} else {
								shopifyProduct.variants.push({
									option1: variantOption0,
									option2: variantOption1,
									price: get(product.variantOptions0, 'price', 0) + get(product.variantOptions1, 'price', 0),
									inventory_quantity: product.variantOptions0.quantity,
									inventory_management: 'shopify',
								})
							}
						}
					} else {
						shopifyProduct.variants.push({
							option1: variantOption0,
							price: get(product.variantOptions0, 'price', 0),
							inventory_quantity: product.variantOptions0.quantity,
							inventory_management: 'shopify',
						})

					}
				}
			}

			// set tags
			shopifyProduct.tags = [shopifyProduct.vendor, shopifyProduct.product_type, 'slug-' + url.split('/').pop()]

			shopifyProduct.tags = shopifyProduct.tags.toString()

			// check if product exists first
			const productQueryResp = await axios
				.post(
					`https://${process.env.SHOPIFY_SHOP}.myshopify.com/admin/api/2022-10/graphql.json`,
					{
						query: `{
							products(first:10, query: "tag:slug-fc-3000-led") {
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
					{
						headers: {
							'Content-Type': 'application/json',
							'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN,
						},
					},
				)
				.catch(err =>
					console.error('Found error in shopify response', err.response.data),
				)

			if (productQueryResp.data.data.products.edges.length > 0) {
				const productId = productQueryResp.data.data.products.edges[0].node.id.split('/').pop()
				shopifyProduct.title = 'test woo'
				shopifyProduct.id = productId

				// for some reason options cannot be an empty array
				if (!shopifyProduct.options.length) {
					delete shopifyProduct.options
				}

				await axios
					.put(
						`https://${process.env.SHOPIFY_SHOP}.myshopify.com/admin/api/2022-10/products/${productId}.json`,
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
						console.error('Found error in shopify put product response', err),
					)
			} else {
				await axios
					.post(
						`https://${process.env.SHOPIFY_SHOP}.myshopify.com/admin/api/2022-10/products.json`,
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
		}

	}

	console.log('done')

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
