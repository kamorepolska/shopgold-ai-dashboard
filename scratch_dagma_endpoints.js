const axios = require('axios');
const fs = require('fs');

async function explore() {
    try {
        const authRes = await axios.post('https://bifrost.dagma.com.pl/api/auth', {
            email: 'sm@idealpc.pl',
            password: '!dgr4cdDd&$ffg246vv!@#$%'
        });
        const token = authRes.data.token;
        
        const endpoints = [
            '/api/main_products',
            '/api/product_catalog/main_products',
            '/api/products',
            '/api/eset/deal_codes',
            '/api/license/user_licenses',
            '/api/orders',
            '/api/pre_orders'
        ];
        
        for (let ep of endpoints) {
            try {
                const res = await axios.get(`https://bifrost.dagma.com.pl${ep}`, {
                    headers: { Authorization: `Bearer ${token}`, Accept: 'application/ld+json' }
                });
                console.log(`Success ${ep}`);
                fs.writeFileSync(`dagma_test_${ep.replace(/\//g, '_')}.json`, JSON.stringify(res.data).substring(0, 500));
            } catch(e) {
                console.log(`Fail ${ep}: ${e.response ? e.response.status : e.message}`);
            }
        }
    } catch(e) {
        console.error('Error:', e.message);
    }
}

explore();
