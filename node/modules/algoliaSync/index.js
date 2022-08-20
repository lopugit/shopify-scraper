
const fs = require('fs')
const dotenv = require('dotenv')
dotenv.config()
const als = require('algoliasearch')

const axios = require('axios')

const { get } = require('lodash')

const parseLinkHeader = require('parse-link-header')

const shopifyApiVersion = '2022-10'

const shopifyRestApi = axios.create({
	baseURL: `https://${process.env.SHOPIFY_SHOP}.myshopify.com/admin/api/${shopifyApiVersion}`,
	headers: {
		'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN,
	},
})

module.exports = async () => {

	console.log('Running syncShopify');

	try {

		const collectsResponse = await shopifyRestApi
			.get(
				'/collects.json',
			)

		let collects = get(collectsResponse, 'data.collects')

		const smartCollectionsResponse = await shopifyRestApi
			.get(
				'/smart_collections.json',
			)

		const smartCollections = get(smartCollectionsResponse, 'data.smart_collections', [])

		collects = [...collects, ...smartCollections.map(smartCollection => ({
			collection_id: smartCollection.id,
		}))]

		const collectionProductsDb = {}

		const collectionsDone = {}

		console.log('collects', collects)

		for (const collect of collects) {
			if (!collectionsDone[collect.collection_id]) {
				collectionsDone[collect.collection_id] = true
				const collectionResponse = await shopifyRestApi
					.get(
						`/collections/${collect.collection_id}/products.json`,
					)
				const collectionProducts = get(collectionResponse, 'data.products')
				console.log('collectionProducts', collectionProducts)
				if (collectionProducts) {
					collectionProducts.forEach(product => {
						collectionProductsDb[product.id] = collectionProductsDb[product.id] || []
						collectionProductsDb[product.id].push(collect.collection_id)
					})
				}
			}
		}

		const response = await shopifyRestApi
			.get(
				'/products.json',
				{
					params: {
					// fields:
					//   'title,status,id,handle,image,images,updated_at,price,variants,slug,description',
						limit: 100,
					},
				},
			)

		let products = get(response, 'data.products')

		if (response.headers.link) {
			let headerLink = get(parseLinkHeader(response.headers.link), 'next.url')
			headerLink = headerLink.split(shopifyApiVersion)[1]
			while (headerLink) {
				console.log('Getting next page of products')
				const nextResponse = await shopifyRestApi
					.get(headerLink, {
					})

				const nextProducts = get(response, 'data.products')
				if (nextProducts) {
					products = [...products, ...nextProducts]
				}

				headerLink = get(nextResponse, 'headers.link')
				headerLink = get(parseLinkHeader(headerLink), 'next.url')
				headerLink = headerLink && headerLink.split(shopifyApiVersion)[1]

			}
		}

		products = products
			.filter(product => product.status === 'active')
			.map(product => {
				const indexes = []
				for (let i = 0; i < product.title.length; i++) {
					indexes.push({
						title: product.title.slice(i, product.title.length),
					})
				}

				return {
					...product,
					price: product.variants[0].price,
					indexes,
					collections: collectionProductsDb[product.id] || [],
				}
			})

		if (products) {
			console.log('Got products successfully')
			fs.writeFileSync('tmp/products.json', JSON.stringify(response.data.products, null, 2))

			console.log('Writing', products.length, 'products to Algolia')

			const client = als(process.env.ALGOLIA_APPLICATION_ID, process.env.ALGOLIA_ADMIN_API_KEY)

			const index = client.initIndex(process.env.ALGOLIA_PREFIX + 'shopify_products')

			await index.replaceAllObjects(products, { autoGenerateObjectIDIfNotExist: true })

			console.log('Wrote products to algolia')

		} else {
			console.error('Something went wrong with the shopify response')
		}
	} catch (error) {
		console.error('Caught error syncing with algolia', error)
	}

}
