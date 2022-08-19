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
	res.status(200).send('Hello Shopify World!')
})

app.listen(port, () => {
	console.log(`Shopify Scraper listening at http://localhost:${port}`)
})

const scrapeMarsHydroProducts = require('sites/marsHydro');

(async () => {

	scrapeMarsHydroProducts()
	setInterval(scrapeMarsHydroProducts, 1000 * 60 * 60) // run every hour

})()

