const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapeDocs() {
    try {
        const client = axios.create({
            baseURL: 'https://bifrost-sandbox.dagma.com.pl',
            withCredentials: true
        });

        // 1. Get login page to extract CSRF
        const res1 = await client.get('/api/docs/login');
        const cookie = res1.headers['set-cookie'];
        const $ = cheerio.load(res1.data);
        const csrf = $('input[name="_csrf_token"]').val();

        // 2. Post login
        const params = new URLSearchParams();
        params.append('_username', 'sm@idealpc.pl');
        params.append('_password', '!dgr4cdDd&$ffg246vv!@#$%');
        params.append('_csrf_token', csrf);

        const res2 = await client.post('/api/docs/login', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookie
            },
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 400
        });

        const authCookie = res2.headers['set-cookie'] || cookie;

        // 3. Get the docs JSON
        const res3 = await client.get('/api/docs.json', {
            headers: { 'Cookie': authCookie }
        });
        
        fs.writeFileSync('dagma_swagger.json', JSON.stringify(res3.data, null, 2));
        console.log('Successfully fetched swagger JSON!');
        
        const res4 = await client.get('/api/docs.jsonld', {
            headers: { 'Cookie': authCookie }
        });
        fs.writeFileSync('dagma_docs.jsonld', JSON.stringify(res4.data, null, 2));
        console.log('Successfully fetched JSONLD docs!');
        
    } catch(e) {
        console.error('Error:', e.message);
    }
}

scrapeDocs();
