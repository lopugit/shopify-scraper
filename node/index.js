require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT
const axios = require('axios')
const pug = require('pug')

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

    let playlistIds = args.playlistIds || []
    let maxResults = args.maxResults || 10

    let videos = []

    let promises = []
    let completed = 0
    let errors = []
    
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
              console.error('uuid 1', err.response.data.error)
              errors.push(err.response.data.error)
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
              console.error('uuid 2', err.response.data.error)
              errors.push(err.response.data.error)
            })

            if (resp && resp.status == 200 && resp.data?.items?.length) {
              let data = resp.data
              let items = data.items

              console.log('Found', items.length, 'videos')
              for (let item of items) {
                videos.push(item)
              }
            } else {
              // search for channel id via 100 quota point search API
              // DISABLED
              // console.log('Didn\'t find any videos for', playlistId, 'trying generalised search')
              // let searchResp = await axios.get('https://www.googleapis.com/youtube/v3/search', {
              // 	params: {
              // 		part: 'id,snippet',
              // 		maxResults: 1,
              // 		q: playlistId,
              // 		key: process.env.API_KEY
              // 	}
              // }).catch(err => {
              // 	console.error(err)
              // })
              // if (searchResp && searchResp.data?.items?.length) {
              // 	playlistId = searchResp.data.items[0].snippet.channelId
              // }

              // playlistIdModified = 'UU' + playlistId.slice(2, playlistId.length)
              // console.log('Getting latest videos for playlistIdModified: ' + playlistIdModified)
              // let resp2 = await axios.get('https://youtube.googleapis.com/youtube/v3/playlistItems',{
              // 	params: {
              // 		playlistId: playlistIdModified,
              // 		part: 'snippet,contentDetails',
              // 		key: process.env.API_KEY,
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
        res()
      }))
    }

    await Promise.all(promises)

    // sort videos by date
    videos.sort((a, b) => {
      return new Date(b.contentDetails.videoPublishedAt) - new Date(a.contentDetails.videoPublishedAt)
    })

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
      videos
    })

  } catch (err) {
    console.error('uuid 4', err)
    res.status(500).send({
      error: 'Something went wrong, please try again later'
    })
  }

})

app.get('/privacy-policy', async (req, res) => {

  return res.send(pug.compile(`
.privacy-policy(
  style="max-width: 600px; margin: 0 auto; padding-top: 100px"
)
  h1.title.text-white(
    style='fontSize: 48px; fontWeight: bold;'
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
`)())

})


app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})