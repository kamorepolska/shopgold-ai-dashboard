'use strict';

const sellasistService = require('./sellasistService');
const dagmaService = require('./dagmaService');
const fs = require('fs');
const path = require('path');

// Prosty magazyn przetworzonych ID zamówień, żeby nie wysyłać podwójnie do Dagmy
const PROCESSED_ORDERS_FILE = path.join(__dirname, '../data/eset_processed_orders.json');

function getProcessedOrders() {
    if (!fs.existsSync(PROCESSED_ORDERS_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(PROCESSED_ORDERS_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function markOrderAsProcessed(orderId) {
    const list = getProcessedOrders();
    if (!list.includes(orderId)) {
        list.push(orderId);
        fs.writeFileSync(PROCESSED_ORDERS_FILE, JSON.stringify(list));
    }
}

/**
 * Szuka nowych opłaconych zamówień na produkty ESET w Sellasist.
 * Jeśli znajdzie, wysyła je do Bifröst API Dagmy celem rejestracji.
 */
async function processNewOrders() {
    console.log('[esetSyncService] Rozpoczynam sprawdzanie zamówień ESET w Sellasist...');
    try {
        // Fetch recent orders. We assume recent 50 orders are enough to poll every 15 mins.
        const response = await sellasistService.fetchApi('/orders?limit=50');
        const orders = Array.isArray(response) ? response : (response.orders || response.items || response.data || []);
        
        const processedList = getProcessedOrders();
        let foundEsetOrders = 0;
        let successfulEsetOrders = 0;

        for (const order of orders) {
            // Ignoruj już przetworzone
            if (processedList.includes(order.id)) continue;
            
            // Check payment status. W Sellasist status zapłaty często jest w 'payment_state' lub 'payment_status'
            const isPaid = order.payment_status === 'paid' || order.payment_state === 'paid' || order.status_id === 2 /* domyślne np 'opłacone' */ || order.is_paid === 1;
            
            if (!isPaid) continue;

            // Check if order contains ESET products
            const products = order.products || order.items || [];
            const esetItems = products.filter(p => (p.name && p.name.toUpperCase().includes('ESET')) || (p.ean && p.ean.startsWith('ESET')));
            
            if (esetItems.length === 0) continue;
            
            foundEsetOrders++;
            console.log(`[esetSyncService] Znaleziono nowe opłacone zamówienie ESET: ${order.id} (${order.client_email})`);

            // Przygotowanie payloadu do Dagmy (zgodnie z Bifröst spec)
            // Pobieramy Imię, Nazwisko z delivery_address lub client_name
            const customerName = (order.delivery_address?.name || order.client_name || order.client_email).split(' ');
            const email = order.client_email;

            // Zbieramy warianty/id ESET w jeden koszyk (w Dagmie potrzebujemy 'id' produktu)
            // Użytkownik musi zmapować Sellasist SKU/EAN z Dagma ID. Załóżmy, że ean w Sellasist = Dagma Product ID
            // albo name zawiera Dagma ID (co jest często praktykowane).
            // Ponieważ nie znamy dokładnego mapowania, zakładamy że ID z dagmy jest trzymane np. w EAN.
            const dagmaProductsPayload = esetItems.map(item => {
                return {
                    id: item.ean || item.sku || item.id, // Tymczasowe mapowanie
                    name: item.name
                };
            });

            const payload = {
                customer: {
                    name: customerName.join(' '),
                    email: email
                },
                products: dagmaProductsPayload
            };

            try {
                // Wyślij do Dagmy (utworzenie Pre-order)
                console.log(`[esetSyncService] Wysyłanie zamówienia ${order.id} do DAGMA...`);
                await dagmaService.createOrder(payload);
                
                // Oznacz jako przetworzone, żeby nie wysłać drugi raz
                markOrderAsProcessed(order.id);
                successfulEsetOrders++;
                console.log(`[esetSyncService] Pomyślnie przetworzono zamówienie ESET: ${order.id}`);

            } catch (dagmaErr) {
                console.error(`[esetSyncService] Błąd podczas wysyłania zam. ${order.id} do Dagmy:`, dagmaErr.message);
                // Nie oznaczamy jako przetworzone, spróbuje ponownie przy następnym cronie,
                // chyba że to permanentny błąd. Warto tu później obsłużyć powiadomienia e-mail o błędzie rejestracji.
            }
        }

        console.log(`[esetSyncService] Sprawdzanie zakończone. Znaleziono: ${foundEsetOrders}, Przetworzono z sukcesem: ${successfulEsetOrders}`);
        return { found: foundEsetOrders, successful: successfulEsetOrders };

    } catch (err) {
        console.error('[esetSyncService] Błąd odpytywania Sellasist:', err.message);
    }
}

module.exports = {
    processNewOrders
};
