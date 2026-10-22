const fs = require('fs');

try {
    const raw = fs.readFileSync('dagma_spec.jsonld', 'utf8');
    const data = JSON.parse(raw);
    
    // Find supported classes and their operations
    const supportedClasses = data['hydra:supportedClass'];
    if (!supportedClasses) {
        console.log('No hydra:supportedClass found.');
        return;
    }
    
    console.log('Classes with POST operations:');
    for (let cls of supportedClasses) {
        const ops = cls['hydra:supportedOperation'];
        if (Array.isArray(ops)) {
            for (let op of ops) {
                if (op['hydra:method'] === 'POST') {
                    console.log(`- ${cls['@id']} -> POST`);
                }
            }
        }
    }
} catch(e) {
    console.error('Error:', e.message);
}
