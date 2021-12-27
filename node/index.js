require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT
const axios = require('axios')

app.use(cors({
	origin: '*:*'
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

		let videos = []

		for (let playlistId of playlistIds) {
			console.log('Getting latest videos for playlistId: ' + playlistId)
			let resp = await axios.get('https://youtube.googleapis.com/youtube/v3/playlistItems',{
				params: {
					playlistId,
					part: 'snippet,contentDetails',
					key: process.env.API_KEY
				}
			}).catch(err => {
				console.error(err.response.data.error)
			})

			if (resp && resp.status == 200) {
				let data = resp.data
				let items = data.items

				for (let item of items) {
					videos.push(item)
				}
			}
			
		}

		// sort videos by date
		videos.sort((a, b) => {
			return new Date(b.contentDetails.videoPublishedAt) - new Date(a.contentDetails.videoPublishedAt)
		})

		console.log('Found', videos.length, 'videos')

		res.status(200).json({
			count: videos.length,
			videos
		})
	} catch (err) {
		res.status(500).json(err)
	}


})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})