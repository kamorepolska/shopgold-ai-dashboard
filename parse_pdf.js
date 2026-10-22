const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('documentation/ELKO_eCommerce_API-User_Manual_BLT.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
});
