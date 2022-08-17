const siteMap = require('sitemap-crawler')
const link = 'https://marshydroau.com/'

siteMap(link, (err, res) => {
	console.error('error', err)
	console.log('siteMap', res)
	console.log('siteMap.length', res.length)
})
