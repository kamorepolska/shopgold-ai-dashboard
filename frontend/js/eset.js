// ESET Store Logic
const esetView = document.getElementById('view-eset');
let esetCart = [];

async function renderEsetStore() {
  if (!esetView) return;
  
  esetView.innerHTML = `
    <div class="eset-header">
      <h2>Bifröst ESET Store</h2>
      <button class="cart-button" onclick="openEsetCart()">
        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
        Koszyk <span class="cart-badge" id="eset-cart-badge" style="display:none">0</span>
      </button>
    </div>

    <!-- ESET Schedule & Sync Control Panel -->
    <div style="background:rgba(0,166,206,0.08); border:1px solid rgba(0,166,206,0.3); border-radius:8px; padding:12px 16px; margin:16px 0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <span id="eset-sched-indicator" style="font-size:1.1rem;">⏳</span>
        <div>
          <div style="font-weight:600; font-size:0.92rem; color:#fff;" id="eset-sched-status-txt">Sprawdzanie stanu harmonogramu...</div>
          <div style="font-size:0.75rem; color:rgba(255,255,255,0.7); margin-top:2px;">Automatycznie weryfikuje opłacone zamówienia ESET w Sellasist.</div>
        </div>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="btn btn--secondary btn--sm" id="eset-sched-toggle-btn" onclick="toggleEsetSchedule()" style="border-color:rgba(255,255,255,0.3); color:#fff;">Zatrzymaj harmonogram</button>
        <button class="btn btn--primary btn--sm" onclick="triggerEsetSyncNow()" style="background:#00A6CE; border:none; color:#fff;">⚡ Sprawdź zamówienia teraz</button>
      </div>
    </div>

    <div id="eset-content" style="text-align:center; padding: 3rem;">
      <div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-top-color:#00A6CE;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;"></div>
      <p>Pobieranie oferty ESET...</p>
    </div>
  `;

  loadEsetScheduleStatus();

  try {
    const data = await API.get('/eset/products');
    
    if (data && data['hydra:member']) {
      const products = data['hydra:member'].filter(p => !p.isDiscontinued);
      renderEsetProducts(products);
    } else {
      document.getElementById('eset-content').innerHTML = `<p style="color:#ef4444">Błąd formatu danych z API.</p>`;
    }
  } catch (err) {
    document.getElementById('eset-content').innerHTML = `<p style="color:#ef4444">Błąd podczas pobierania produktów: ${err.message}</p>`;
  }
}

function renderEsetProducts(products) {
  if (products.length === 0) {
    document.getElementById('eset-content').innerHTML = `<p>Brak produktów w ofercie.</p>`;
    return;
  }
  
  let html = `<div class="products-grid">`;
  products.forEach((p, idx) => {
    const pStr = JSON.stringify({id: p.id, name: p.name}).replace(/"/g, '&quot;');
    let priceElement = '';
    let cartButton = '';
    if (p.id.includes('HOME')) {
      priceElement = `<span style="font-size:1.25rem; font-weight:bold">129 PLN</span>`;
      cartButton = `<button class="btn-primary" data-product="${pStr}" onclick="addToEsetCart(this)">Do Koszyka</button>`;
    } else {
      priceElement = `<button class="btn-primary" style="background:transparent;border:1px solid #00A6CE;color:#00A6CE;" onclick="window.Toast.info('Aby uzyskać wycenę pakietów biznesowych, skontaktuj się z opiekunem handlowym.')">Zapytaj o cenę</button>`;
      cartButton = `<button class="btn-primary" data-product="${pStr}" onclick="addToEsetCart(this)">Do Koszyka</button>`;
    }
    
    html += `
      <div class="product-card">
        <div class="product-category">${p.category?.name || 'Oprogramowanie'}</div>
        <h3 class="product-title">${p.name}</h3>
        <p class="product-desc">Rozwiązanie klasy premium do zaawansowanej ochrony przed zagrożeniami.</p>
        <div class="product-footer">
          ${priceElement}
          ${cartButton}
        </div>
      </div>
    `;
  });
  html += `</div>`;
  
  // Append Modal HTML
  html += `
    <div class="eset-modal-overlay" id="eset-cart-modal">
      <div class="eset-modal-content">
        <div class="eset-modal-header">
          <h3>Koszyk ESET</h3>
          <button class="eset-close-btn" onclick="closeEsetCart()">&times;</button>
        </div>
        <div id="eset-cart-body"></div>
      </div>
    </div>
  `;
  
  document.getElementById('eset-content').innerHTML = html;
}

window.addToEsetCart = function(btn) {
  const pStr = btn.getAttribute('data-product');
  const p = JSON.parse(pStr);
  esetCart.push(p);
  const badge = document.getElementById('eset-cart-badge');
  badge.textContent = esetCart.length;
  badge.style.display = 'inline-block';
  if (window.Toast) {
    window.Toast.success('Dodano do koszyka: ' + p.name);
  } else {
    alert('Dodano do koszyka: ' + p.name);
  }
};

window.openEsetCart = function() {
  const modal = document.getElementById('eset-cart-modal');
  if (!modal) return;
  
  renderCartBody();
  modal.classList.add('active');
};

window.closeEsetCart = function() {
  const modal = document.getElementById('eset-cart-modal');
  if (modal) modal.classList.remove('active');
};

window.removeEsetCartItem = function(index) {
  esetCart.splice(index, 1);
  const badge = document.getElementById('eset-cart-badge');
  badge.textContent = esetCart.length;
  if(esetCart.length === 0) badge.style.display = 'none';
  renderCartBody();
};

function renderCartBody() {
  const body = document.getElementById('eset-cart-body');
  if (esetCart.length === 0) {
    body.innerHTML = `<p style="color:#94a3b8; text-align:center;">Twój koszyk jest pusty.</p>`;
    return;
  }
  
  let html = `<div style="max-height:200px; overflow-y:auto; margin-bottom:1.5rem">`;
  esetCart.forEach((item, idx) => {
    html += `
      <div class="eset-cart-item">
        <span>${item.name}</span>
        <button type="button" onclick="removeEsetCartItem(${idx})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-weight:bold;font-size:1.2rem">✕</button>
      </div>
    `;
  });
  html += `</div>`;
  
  html += `
    <h4 style="margin-bottom:1rem">Dane Rejestracyjne Licencji</h4>
    <form id="eset-order-form" onsubmit="submitEsetOrder(event)">
      <div class="eset-form-group">
        <label>Imię i nazwisko / Firma</label>
        <input type="text" id="eset-order-name" class="eset-form-control" required>
      </div>
      <div class="eset-form-group">
        <label>E-mail (do wysyłki klucza)</label>
        <input type="email" id="eset-order-email" class="eset-form-control" required>
      </div>
      <button type="submit" class="btn-primary" style="width:100%; margin-top:1rem" id="eset-order-btn">Złóż Zamówienie (Bifröst)</button>
    </form>
  `;
  
  body.innerHTML = html;
}

window.submitEsetOrder = async function(e) {
  e.preventDefault();
  const btn = document.getElementById('eset-order-btn');
  btn.disabled = true;
  btn.textContent = 'Wysyłanie...';
  
  const payload = {
    customer: {
      name: document.getElementById('eset-order-name').value,
      email: document.getElementById('eset-order-email').value
    },
    products: esetCart
  };
  
  try {
    const data = await API.post('/eset/orders', payload);
    
    document.getElementById('eset-cart-body').innerHTML = `
      <div style="text-align:center; padding: 2rem 0;">
        <div style="color:#10b981; font-size:3rem; margin-bottom:1rem">✓</div>
        <h3>Zamówienie wysłane!</h3>
        <p style="color:#94a3b8">Bifröst przetwarza rejestrację licencji.</p>
        <button class="btn-primary" style="margin-top:2rem" onclick="closeEsetCart()">Zamknij</button>
      </div>
    `;
    esetCart = [];
    document.getElementById('eset-cart-badge').style.display = 'none';
    
  } catch (err) {
    showToast('Błąd API Dagmy: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Złóż Zamówienie (Bifröst)';
  }
};

// Initialize view when ESET tab is clicked
document.addEventListener('DOMContentLoaded', () => {
  const navEset = document.getElementById('nav-eset');
  if (navEset) {
    navEset.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      navEset.classList.add('active');
      
      document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
      esetView.classList.add('active');
      
      document.getElementById('page-title').textContent = 'Sklep ESET';
      
      // Load products if empty
      if (esetView.innerHTML.trim() === '') {
        renderEsetStore();
      }
    });
  }
});

let _esetScheduleEnabled = true;

async function loadEsetScheduleStatus() {
  const ind = document.getElementById('eset-sched-indicator');
  const txt = document.getElementById('eset-sched-status-txt');
  const btn = document.getElementById('eset-sched-toggle-btn');
  if (!ind || !txt || !btn) return;

  try {
    const status = await API.get('/eset/schedule/status');
    _esetScheduleEnabled = status.enabled && status.running;
    if (_esetScheduleEnabled) {
      ind.textContent = '🟢';
      txt.textContent = `Harmonogram ESET aktywny (${status.cron || 'co 15 min'})`;
      btn.textContent = 'Zatrzymaj harmonogram';
      btn.style.background = 'transparent';
      btn.style.borderColor = '#ef4444';
      btn.style.color = '#ef4444';
    } else {
      ind.textContent = '🔴';
      txt.textContent = 'Harmonogram ESET zatrzymany (brak automatycznego weryfikowania)';
      btn.textContent = '▶ Włącz harmonogram';
      btn.style.background = '#22c55e';
      btn.style.borderColor = '#22c55e';
      btn.style.color = '#fff';
    }
  } catch(e) {
    console.error('Błąd pobierania stanu harmonogramu ESET:', e);
    ind.textContent = '⚠️';
    txt.textContent = 'Nie udało się pobrać stanu harmonogramu';
  }
}

async function toggleEsetSchedule() {
  const btn = document.getElementById('eset-sched-toggle-btn');
  const newState = !_esetScheduleEnabled;
  if (btn) btn.disabled = true;
  try {
    await API.post('/eset/schedule/toggle', { enabled: newState });
    showToast(newState ? '✅ Włączono harmonogram ESET' : '🛑 Zatrzymano harmonogram ESET', 'success');
    await loadEsetScheduleStatus();
  } catch(e) {
    showToast('Błąd zmiany stanu harmonogramu: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function triggerEsetSyncNow() {
  try {
    showToast('⏳ Sprawdzam nowe zamówienia ESET w Sellasist...', 'info');
    const res = await API.post('/eset/schedule/trigger', {});
    showToast('✅ ' + (res.message || 'Synchronizacja zakończona'), 'success');
  } catch(e) {
    showToast('❌ Błąd synchronizacji: ' + e.message, 'error');
  }
}

window.loadEsetScheduleStatus = loadEsetScheduleStatus;
window.toggleEsetSchedule = toggleEsetSchedule;
window.triggerEsetSyncNow = triggerEsetSyncNow;
