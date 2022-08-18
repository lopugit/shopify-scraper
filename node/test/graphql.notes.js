import fetch from 'node-fetch';

const apiKey = 'xxxx';
const accessToken = 'yyyy';
const store = 'zzzz';
const hostName = store + '.myshopify.com';
const apiVersion = '2021-01';
const apiLocation = '/admin/api/';

const rootUrl = 'https://' + apiKey + ':' + accessToken + '@' + hostName + apiLocation + apiVersion + '/';

const shopGraphQl = 'https://' + hostName + apiLocation + apiVersion + '/graphql.json';
// const shopGraphQl2 = rootUrl + 'graphql.json';
// const urlTest = rootUrl + 'orders.json';

const url = shopGraphQl;

const body = {
	query: `{
        shop {
            name
          }
      }`,
};

fetch(
	url,
	{
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Shopify-Access-Token': accessToken,
		},
		body: JSON.stringify({
			body,
		}),
	},
)
	.then(res => {
		console.log('status = ' + res.status + ' , ' + res.statusText);
	})
	.then(json => {
		console.log('data returned:\n', json);
	})
	.catch(err => console.error(err));
