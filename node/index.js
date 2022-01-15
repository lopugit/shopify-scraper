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

// Mongodb setup
let cacheCollection
let collections
try {
	const { MongoClient } = require('mongodb')
	const url = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PWD}@${process.env.MONGODB_CLUSTER}.nhb33.mongodb.net/${process.env.MONGODB_DB}?retryWrites=true&w=majority`
	console.log('Connecting to MongoDB with url', url)
	const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true })

	// Connect to client
	client.connect(err => {
		if (err) {
			console.error('Connection failed', err)
		} else {
			console.log('Connected to MongoDB')
			cacheCollection = client.db(process.env.MONGODB_DB).collection('cache')
			collections = client.db(process.env.MONGODB_DB).collection('collections')
		}
	})
} catch (err) {
	console.error(err)
}

// Express middleware
app.use(cors({
	origin: '*',
}))

app.get('/', (req, res) => {
	res.send('Hello YT World!')
})

app.get('/v1/get-collection', async (req, res) => {

	const { name } = req.query

	// Get the collection
	const collection = await collections.findOne({ name: name.toLowerCase() })

	if (collection) {
		res.send({ collection })
	} else {
		res.status(500).send({ error: 'No collection found' })
	}

})

app.post('/v1/save-collection', async (req, res) => {

	const { name, author, email, password, channels } = req.body
	if (!(name && author && email && channels && channels.length && password && password.length >= 8)) {
		const error = { error: 'Missing required fields' }
		console.log('uuid 7', error)
		res.status(500).send(error)
		return
	}

	// Check if collection already exists
	const existingCollection = await collections.findOne({ name: name.toLowerCase() })

	// If already exists, check password matches
	if (existingCollection) {
		if (bcrypt.compareSync(password, existingCollection.password)) {
			collections.findOneAndUpdate({
				name: name.toLowerCase(),
			}, {
				$set: {
					channels,
					author,
					email,
				},
			}, {
				upsert: true,
			})
			res.send('Success')
		} else {
			const error = { error: 'Incorrect password' }
			console.error('uuid 10', error)
			res.status(500).send(error)
		}
	} else {
		// Hash password and save collection
		const hashedPassword = await bcrypt.hash(password, saltRounds)
		await collections.insertOne({
			name: name.toLowerCase(),
			author,
			email,
			password: hashedPassword,
			channels,
		})
		res.send('Collection saved')
	}

})

app.get('/v1/channel-search', async (req, res) => {

	console.log(req.query)
	const { query } = req.query

	// Check mongodb cache for results
	const cached = await cacheCollection.find({
		query,
		cacheDate: {
			$gte: DateTime.local().minus({ days: 10 }).toSeconds(),
		},
	}).toArray()

	if (cached && cached[0] && cached[0].results) {
		console.log('Found cached results')
		res.send({ results: cached[0].results })
	} else {
		try {
			const url = 'https://www.googleapis.com/youtube/v3/search'
			const response = await axios.get(url, {
				params: {
					q: query,
					part: 'snippet',
					maxResults: 50,
					type: 'channel',
					key: process.env.YOUTUBE_API_KEY,
				},
			}).catch(err => {
				console.error(err)
			})

			const { items } = response.data
			const results = items

			res.send({ results })

			cacheCollection.insertOne({
				query,
				results,
				cacheDate: DateTime.local().toSeconds(),
			})
		} catch (err) {
			console.error(err)
			res.status(500).send({ error: 'Something went wrong fetching channels with query' })
		}
	}
})

app.get('/v1/profile-pictures', async (req, res) => {
	// https://www.googleapis.com/youtube/v3/channels?
	// part=snippet
	// &id='+commaSeperatedList+'
	// &fields=items(id,snippet_thumbnails)
	// &key={YOUR_API_KEY}

	try {
		const args = req.query
		console.log(req.query)

		const channelIds = args.channelIds || []
		const commaSeperatedList = channelIds.join(',')
		const errors = []

		const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
			params: {
				part: 'snippet',
				id: commaSeperatedList,
				fields: 'items(id,snippet/thumbnails)',
				key: process.env.YOUTUBE_API_KEY,
			},
		}).catch(err => {
			console.error('uuid 1', err.response.data.error)
			errors.push(err.response.data.error)
		})

		if (response && response.data && response.data.items) {
			const profilePictures = response.data.items.map(item => ({
				...item,
				url: item.snippet.thumbnails.default.url,
			}))
			res.send({ profilePictures })
		} else {
			res.send({ profilePictures: [] })
		}
	} catch (err) {
		console.error('uuid 5', err)
		res.status(500).send({
			error: 'Something went wrong getting profile pictures, please try again later',
		})
	}
})

app.get('/v1/videos', async (req, res) => {
	// https://youtube.googleapis.com/youtube/v3/playlistItems?
	// playlistId=UU3Wn3dABlgESm8Bzn8Vamgg
	// key=[YOUR_API_KEY]

	try {
		const args = req.query
		console.log(req.query)

		const playlistIds = args.playlistIds || []
		const maxResults = args.maxResults || 100

		const videos = []

		const promises = []
		let completed = 0
		const errors = []

		for (let playlistId of playlistIds) {
			promises.push(new Promise(async (resolve, reject) => {
				try {
					if (playlistId.length) {
						console.log('Trying to get channel id from username', playlistId)
						const usernameResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
							params: {
								part: 'id',
								key: process.env.YOUTUBE_API_KEY,
								forUsername: playlistId,
							},
						}).catch(err => {
							console.error('uuid 1', err.response.data.error)
							errors.push(err.response.data.error)
						})
						if (usernameResponse && usernameResponse.data && usernameResponse.data.pageInfo.totalResults > 0) {
							playlistId = usernameResponse.data.items[0].id
						}

						const playlistIdModified = 'UU' + playlistId.slice(2, playlistId.length)
						console.log('Getting latest videos for playlistIdModified: ' + playlistIdModified)
						const response = await axios.get('https://youtube.googleapis.com/youtube/v3/playlistItems', {
							params: {
								playlistId: playlistIdModified,
								part: 'snippet,contentDetails',
								key: process.env.YOUTUBE_API_KEY,
								maxResults,
							},
						}).catch(err => {
							console.error('uuid 2', err.response.data.error)
							errors.push(err.response.data.error)
						})

						if (response && response.status === 200 && response.data?.items?.length) {
							const { data } = response
							const { items } = data

							console.log('Found', items.length, 'videos')
							for (const item of items) {
								videos.push(item)
							}
						} else {
							// Search for channel id via 100 quota point search API
							// DISABLED
							// console.log('Didn\'t find any videos for', playlistId, 'trying generalised search')
							// let searchResp = await axios.get('https://www.googleapis.com/youtube/v3/search', {
							// 	params: {
							// 		part: 'id,snippet',
							// 		maxResults: 1,
							// 		q: playlistId,
							// 		key: process.env.YOUTUBE_API_KEY
							// 	}
							// }).catch(err => {
							// 	console.error(err)
							// })
							// if (searchResp && searchResponse.data?.items?.length) {
							// 	playlistId = searchResponse.data.items[0].snippet.channelId
							// }

							// playlistIdModified = 'UU' + playlistId.slice(2, playlistId.length)
							// console.log('Getting latest videos for playlistIdModified: ' + playlistIdModified)
							// let resp2 = await axios.get('https://youtube.googleapis.com/youtube/v3/playlistItems',{
							// 	params: {
							// 		playlistId: playlistIdModified,
							// 		part: 'snippet,contentDetails',
							// 		key: process.env.YOUTUBE_API_KEY,
							// 		maxResults
							// 	}
							// }).catch(err => {
							// 	console.error(err.response.data.error)
							// })

							// if (resp2 && resp2.status == 200 && resp2.data?.items?.length) {
							// 	let data = resp2.data
							// 	let items = data.items

							// 	console.log('Found', items.length, 'videos')
							// 	for (let item of items) {
							// 		videos.push(item)
							// 	}
							// }
						}
					}
				} catch (err) {
					console.error('uuid 3', err)
				}

				completed++
				resolve()
			}))
		}

		await Promise.all(promises)

		// Sort videos by date
		videos.sort((a, b) => new Date(b.contentDetails.videoPublishedAt) - new Date(a.contentDetails.videoPublishedAt))

		console.log('Found', videos.length, 'videos total')

		let quotaReached = false
		errors.forEach(error => {
			if (error.message.includes('The request cannot be completed because you have exceeded your')) {
				quotaReached = true
			}
		})

		res.status(200).json({
			error: quotaReached && 'Sorry, the app is too popular and YouTube only allows a few API requests, the YouTube Data API Quota has been reached, please try again tomorrow',
			count: videos.length,
			completed,
			videos,
		})
	} catch (err) {
		console.error('uuid 4', err)
		res.status(500).send({
			error: 'Something went wrong getting videos, please try again later',
		})
	}
})

app.get('/privacy-policy', async (req, res) => res.send(pug.compile(`
.privacy-policy(
  style="max-width: 600px margin: 0 auto padding-top: 100px"
)
  h1.title.text-white(
    style='fontSize: 48px fontWeight: bold'
  )
    | Privacy Policy
  p.subtitle
    | The friendly Subber API Privacy Policy
  p.answer
    .pt-12 This API uses YouTube API Services
    .pt-12 Subber API does not use any analytics tools to store any data, nor does it store any user data of any kind.
    .pt-12 We do not allow any 3rd parties to serve Ads on Subber API
  .pt-12 You can contact Subber API at
    a(href='emailto:subberAPI@alopu.com', style="padding-left: 6px") subberAPI@alopu.com
  .pt-12
    a.underline(href='https://www.youtube.com/t/terms') YouTube Terms of Service
  .pt-12
    a.underline(href='https://policies.google.com/privacy') Google Privacy Policy
style(type="text/css").
  .pt-12 { padding-top: 12px }
`)()))

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`)
})
