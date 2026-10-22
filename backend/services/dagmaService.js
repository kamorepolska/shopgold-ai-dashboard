const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

class DagmaService {
    constructor() {
        this.apiUrl = process.env.DAGMA_API_URL || 'https://bifrost-sandbox.dagma.com.pl';
        this.email = process.env.DAGMA_API_EMAIL;
        this.password = process.env.DAGMA_API_PASSWORD;
        this.token = null;
        this.tokenExpiration = null; // timestamp of expiration
        this.axiosInstance = axios.create({
            baseURL: this.apiUrl,
            headers: {
                'Accept': 'application/ld+json',
                'Content-Type': 'application/json'
            }
        });
        
        // Add interceptor to automatically add token
        this.axiosInstance.interceptors.request.use(async (config) => {
            if (config.url !== '/api/auth') {
                const token = await this.getToken();
                if (token) {
                    config.headers['Authorization'] = `Bearer ${token}`;
                }
            }
            return config;
        });
    }

    async getToken() {
        // Simple token caching (Bifrost tokens are valid for 1 hour)
        if (this.token && this.tokenExpiration && Date.now() < this.tokenExpiration) {
            return this.token;
        }

        try {
            console.log(`[DagmaService] Authenticating to ${this.apiUrl}...`);
            const res = await axios.post(`${this.apiUrl}/api/auth`, {
                email: this.email,
                password: this.password
            });
            this.token = res.data.token;
            // Set expiration to 55 minutes from now just to be safe
            this.tokenExpiration = Date.now() + (55 * 60 * 1000);
            return this.token;
        } catch (error) {
            console.error('[DagmaService] Authentication error:', error.response ? error.response.data : error.message);
            throw new Error('Could not authenticate with DAGMA API');
        }
    }

    /**
     * Get the catalog of main ESET products
     */
    async getProducts(page = 1) {
        try {
            const res = await this.axiosInstance.get('/api/product-catalog/main-products', {
                params: { page }
            });
            return res.data;
        } catch (error) {
            console.error('[DagmaService] getProducts error:', error.response ? error.response.data : error.message);
            throw error;
        }
    }

    /**
     * Create a new order
     * Note: This requires understanding the exact schema for /api/order/orders.
     * We pass payload directly from frontend/controller for now.
     */
    async createOrder(orderPayload) {
        try {
            const res = await this.axiosInstance.post('/api/order/pre-orders', orderPayload);
            return res.data;
        } catch (error) {
            console.error('[DagmaService] createOrder error:', error.response ? error.response.data : error.message);
            // Handle "permanent error" DOS warning explicitly
            if (error.response && error.response.status >= 400 && error.response.status < 500) {
                // Return exact error so UI knows not to retry automatically
                throw { isPermanent: true, details: error.response.data };
            }
            throw error;
        }
    }
}

module.exports = new DagmaService();
