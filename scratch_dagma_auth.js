const axios = require('axios');

async function explore() {
    const payloads = [
        { login: 'sm@idealpc.pl', password: '!dgr4cdDd&$ffg246vv!@#$%' },
        { email: 'sm@idealpc.pl', password: '!dgr4cdDd&$ffg246vv!@#$%' },
        { username: 'sm@idealpc.pl', password: '!dgr4cdDd&$ffg246vv!@#$%' }
    ];

    for (let p of payloads) {
        try {
            console.log('Trying', Object.keys(p)[0]);
            const authRes = await axios.post('https://bifrost.dagma.com.pl/api/auth', p);
            console.log('Auth success. Token:', authRes.data);
            return;
        } catch(e) {
            console.log('Failed:', e.response ? e.response.data : e.message);
        }
    }
}

explore();
