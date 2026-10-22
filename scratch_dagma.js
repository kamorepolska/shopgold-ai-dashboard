const axios = require('axios');
const fs = require('fs');

async function explore() {
    try {
        const authRes = await axios.post('https://bifrost.dagma.com.pl/api/auth', {
            email: 'sm@idealpc.pl',
            password: '!dgr4cdDd&$ffg246vv!@#$%'
        });
        
        const token = authRes.data.token;
        
        // Try to fetch index
        try {
            const res = await axios.get('https://bifrost.dagma.com.pl/api/docs.jsonld', {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('docs.jsonld success!');
            fs.writeFileSync('dagma_spec.jsonld', JSON.stringify(res.data, null, 2));
        } catch(e) {
            console.log('docs.jsonld failed');
        }
        
        try {
            const res = await axios.get('https://bifrost.dagma.com.pl/api/contexts/Entrypoint', {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Entrypoint success!', Object.keys(res.data));
        } catch(e) {
            console.log('Entrypoint failed');
        }

        try {
            const res = await axios.get('https://bifrost.dagma.com.pl/api', {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/ld+json'
                }
            });
            console.log('/api success!');
            fs.writeFileSync('dagma_entrypoint.json', JSON.stringify(res.data, null, 2));
            console.log('Keys:', Object.keys(res.data));
        } catch(e) {
            console.log('/api failed');
        }

    } catch(e) {
        console.error('Error:', e.message);
    }
}

explore();
