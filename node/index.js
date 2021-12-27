require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT
const axios = require('axios')

app.use(cors({
	origin: '*'
}))

app.get('/', (req, res) => {
  res.send('Hello YT World!')
})

app.get('/v1/videos', async (req, res) => {
	// https://youtube.googleapis.com/youtube/v3/playlistItems?
	// playlistId=UU3Wn3dABlgESm8Bzn8Vamgg
	// key=[YOUR_API_KEY]

	try {

		let args = req.query
		console.log(req.query)

		let playlistIds = args.playlistIds
		let maxResults = args.maxResults || 10

		let videos = []

		let promises = []
		let completed = 0
		
		for (let playlistId of playlistIds) {
			promises.push(new Promise(async (res, rej) => {
				try {
					if (playlistId.length) {
						console.log('Trying to get channel id from username', playlistId)
						let usernameResp = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
							params: {
								part: 'id',
								key: process.env.API_KEY,
								forUsername: playlistId
							}
						}).catch(err => {
							console.error(err)
						})
						if (usernameResp && usernameResp.data && usernameResp.data.pageInfo.totalResults > 0) {
							playlistId = usernameResp.data.items[0].id
						}
						let playlistIdModified = 'UU' + playlistId.slice(2, playlistId.length)
						console.log('Getting latest videos for playlistIdModified: ' + playlistIdModified)
						let resp = await axios.get('https://youtube.googleapis.com/youtube/v3/playlistItems',{
							params: {
								playlistId: playlistIdModified,
								part: 'snippet,contentDetails',
								key: process.env.API_KEY,
								maxResults
							}
						}).catch(err => {
							console.error(err.response.data.error)
						})

						if (resp && resp.status == 200 && resp.data?.items?.length) {
							let data = resp.data
							let items = data.items

							console.log('Found', items.length, 'videos')
							for (let item of items) {
								videos.push(item)
							}
						} else {
							console.log('Didn\'t find any videos for', playlistId, 'trying generalised search')
							let searchResp = await axios.get('https://www.googleapis.com/youtube/v3/search', {
								params: {
									part: 'id,snippet',
									maxResults: 1,
									q: playlistId,
									key: process.env.API_KEY
								}
							}).catch(err => {
								console.error(err)
							})
							if (searchResp && searchResp.data?.items?.length) {
								playlistId = searchResp.data.items[0].snippet.channelId
							}

							playlistIdModified = 'UU' + playlistId.slice(2, playlistId.length)
							console.log('Getting latest videos for playlistIdModified: ' + playlistIdModified)
							let resp2 = await axios.get('https://youtube.googleapis.com/youtube/v3/playlistItems',{
								params: {
									playlistId: playlistIdModified,
									part: 'snippet,contentDetails',
									key: process.env.API_KEY,
									maxResults
								}
							}).catch(err => {
								console.error(err.response.data.error)
							})

							if (resp2 && resp2.status == 200 && resp2.data?.items?.length) {
								let data = resp2.data
								let items = data.items

								console.log('Found', items.length, 'videos')
								for (let item of items) {
									videos.push(item)
								}
							}					
						}
					}
				} catch (err) {
					console.error(err)
				}
				completed++
				res()
			}))
		}

		await Promise.all(promises)

		// sort videos by date
		videos.sort((a, b) => {
			return new Date(b.contentDetails.videoPublishedAt) - new Date(a.contentDetails.videoPublishedAt)
		})

		console.log('Found', videos.length, 'videos total')

		res.status(200).json({
			count: videos.length,
			completed,
			videos
		})

	} catch (err) {
		console.error(err)
		res.status(500).json(err)
	}

})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})