const axios = require('axios');
const dagmaService = require('./backend/services/dagmaService');
require('dotenv').config();

async function testOrder() {
    try {
        console.log('Fetching products to pick one for the order...');
        const catalog = await dagmaService.getProducts(1);
        const products = catalog['hydra:member'].filter(p => !p.isDiscontinued);
        
        if (products.length === 0) {
            console.log('No active products found.');
            return;
        }
        
        const testProduct = products[0];
        console.log('Testing order for product:', testProduct.id, testProduct.name);
        
        // Simulating the payload the frontend would send
        const orderPayload = {
            // Note: The structure here might be incorrect for DAGMA since we don't have the exact JSONld format for order:Order
            // But we will send it and see what the API Platform says (it usually gives detailed 400 validation errors).
            customer: {
                name: 'Jan Kowalski TEST',
                email: 'jan.kowalski@example.com'
            },
            products: [
                { id: testProduct.id, name: testProduct.name }
            ]
        };
        
        const res = await dagmaService.createOrder(orderPayload);
        console.log('Order created successfully!', res);
    } catch(e) {
        if (e.isPermanent) {
            console.log('Permanent error from Dagma (DO NOT RETRY):', JSON.stringify(e.details, null, 2));
        } else {
            console.error('Error placing order:', e.response ? e.response.data : e.message);
        }
    }
}

testOrder();
