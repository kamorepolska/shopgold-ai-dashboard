/* ==========================================================================
   notifications.js — Unified Notifications Module Handler (SPA View)
   ========================================================================== */
'use strict';

window.NotificationsView = {
  currentTab: 'all', // 'all', 'crm', 'sourcing', 'grafiker', 'unread'
  items: [],
  unreadCount: 0,

  async render() {
    const viewContainer = document.getElementById('view-notifications');
    if (!viewContainer) return;

    // Set initial loading state
    viewContainer.innerHTML = `
      <div class="notifications-container">
        <div class="notifications-header-actions">
          <div class="notifications-title-area">
            <h2>Powiadomienia</h2>
            <p>Ładowanie powiadomień...</p>
          </div>
        </div>
        <div style="display:flex; justify-content:center; padding: 60px 0;">
          <div class="btn--loading" style="width: 40px; height: 40px;"></div>
        </div>
      </div>
    `;

    try {
      await this.loadData();
      this.draw();
    } catch (err) {
      console.error('[NotificationsView] Failed to render:', err);
      viewContainer.innerHTML = `
        <div class="notifications-container">
          <div class="notifications-header-actions">
            <div class="notifications-title-area">
              <h2>Powiadomienia</h2>
              <p style="color:#ef4444">Błąd ładowania: ${err.message}</p>
            </div>
          </div>
        </div>
      `;
    }
  },

  async loadData() {
    const res = await API.get('/notifications');
    if (res.success) {
      this.items = res.items || [];
      this.unreadCount = res.unread || 0;
    } else {
      throw new Error(res.error || 'Nie udało się pobrać powiadomień');
    }
  },

  draw() {
    const viewContainer = document.getElementById('view-notifications');
    if (!viewContainer) return;

    // Filter items based on active tab
    const filteredItems = this.getFilteredItems();

    // Group items by relative date
    const grouped = this.groupItems(filteredItems);

    const totalUnread = this.items.filter(x => !x.is_read).length;
    const crmCount = this.items.filter(x => x.module === 'crm').length;
    const sourcingCount = this.items.filter(x => x.module === 'sourcing').length;
    const grafikerCount = this.items.filter(x => x.module === 'grafiker').length;

    let html = `
      <div class="notifications-container">
        <!-- Header area -->
        <div class="notifications-header-actions">
          <div class="notifications-title-area">
            <h2>Centrum Powiadomień</h2>
            <p>Przeglądaj wszystkie powiadomienia i alerty systemowe.</p>
          </div>
          <div class="notifications-global-btns">
            ${this.items.length > 0 ? `
              <button class="btn btn--secondary" id="notif-mark-all-read-btn">
                <span>✓</span> Oznacz wszystkie jako przeczytane
              </button>
              <button class="btn btn--danger btn--ghost" id="notif-clear-all-btn">
                <span>🗑️</span> Wyczyść wszystko
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Translucent Filter Tabs Bar -->
        <div class="notifications-tabs-bar">
          <button class="notifications-tab-btn ${this.currentTab === 'all' ? 'active' : ''}" data-tab="all">
            Wszystkie <span class="tab-count">${this.items.length}</span>
          </button>
          <button class="notifications-tab-btn ${this.currentTab === 'unread' ? 'active' : ''}" data-tab="unread">
            Nieprzeczytane <span class="tab-count">${totalUnread}</span>
          </button>
          <button class="notifications-tab-btn ${this.currentTab === 'crm' ? 'active' : ''}" data-tab="crm">
            CRM <span class="tab-count">${crmCount}</span>
          </button>
          <button class="notifications-tab-btn ${this.currentTab === 'sourcing' ? 'active' : ''}" data-tab="sourcing">
            Hurtownie <span class="tab-count">${sourcingCount}</span>
          </button>
          <button class="notifications-tab-btn ${this.currentTab === 'grafiker' ? 'active' : ''}" data-tab="grafiker">
            Grafika <span class="tab-count">${grafikerCount}</span>
          </button>
        </div>

        <!-- Notifications Content -->
        <div class="notifications-list">
    `;

    if (filteredItems.length === 0) {
      html += this.renderEmptyState();
    } else {
      // Group: Today, Yesterday, Older
      const groupKeys = ['Dzisiaj', 'Wczoraj', 'Starsze'];
      for (const groupKey of groupKeys) {
        if (grouped[groupKey] && grouped[groupKey].length > 0) {
          html += `
            <div class="notifications-group">
              <div class="notifications-group-title">${groupKey}</div>
              <div class="notifications-group-items">
          `;

          for (const item of grouped[groupKey]) {
            html += this.renderNotificationCard(item);
          }

          html += `
              </div>
            </div>
          `;
        }
      }
    }

    html += `
        </div>
      </div>
    `;

    viewContainer.innerHTML = html;
    this.bindEvents();
  },

  getFilteredItems() {
    if (this.currentTab === 'all') return this.items;
    if (this.currentTab === 'unread') return this.items.filter(x => !x.is_read);
    return this.items.filter(x => x.module === this.currentTab);
  },

  groupItems(items) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const groups = {
      'Dzisiaj': [],
      'Wczoraj': [],
      'Starsze': []
    };

    for (const item of items) {
      const itemDate = new Date(item.created_at + 'Z'); // parse as UTC
      
      if (this.isSameDay(itemDate, today)) {
        groups['Dzisiaj'].push(item);
      } else if (this.isSameDay(itemDate, yesterday)) {
        groups['Wczoraj'].push(item);
      } else {
        groups['Starsze'].push(item);
      }
    }

    return groups;
  },

  isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  },

  renderNotificationCard(item) {
    const isUnread = !item.is_read;
    const dateStr = window.fmtDate ? window.fmtDate(item.created_at + 'Z') : new Date(item.created_at).toLocaleString();

    // Module Specific Icons and Names
    const moduleIcons = {
      crm: `<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/></svg>`,
      sourcing: `<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z"/><path d="M16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>`,
      grafiker: `<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/></svg>`,
      general: `<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`
    };

    const moduleLabel = {
      crm: 'CRM',
      sourcing: 'Hurtownie',
      grafiker: 'Grafiker AI',
      general: 'System'
    };

    return `
      <div class="notification-card module-${item.module} ${isUnread ? 'unread' : ''}" data-id="${item.id}">
        <div class="notification-icon-wrapper">
          ${moduleIcons[item.module] || moduleIcons.general}
        </div>
        <div class="notification-content">
          <div class="notification-title-row">
            <h4 class="notification-title">${escHtml(item.title)}</h4>
            <span class="notification-time">${dateStr}</span>
          </div>
          <p class="notification-message">${escHtml(item.message)}</p>
          <div class="notification-meta-tags">
            <span class="notification-badge-tag">${moduleLabel[item.module] || 'System'}</span>
            <span class="notification-status-tag">${isUnread ? 'Nowe' : 'Przeczytane'}</span>
          </div>
        </div>
        <div class="notification-actions">
          ${isUnread ? `
            <button class="notification-act-btn mark-read-btn" title="Oznacz jako przeczytane" data-id="${item.id}">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </button>
          ` : ''}
          <button class="notification-act-btn delete delete-btn" title="Usuń powiadomienie" data-id="${item.id}">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  },

  renderEmptyState() {
    const tabLabels = {
      all: 'Centrum Powiadomień',
      unread: 'Brak nieprzeczytanych powiadomień',
      crm: 'Brak powiadomień CRM',
      sourcing: 'Brak powiadomień z Hurtowni',
      grafiker: 'Brak powiadomień z Grafikera'
    };
    const desc = this.currentTab === 'unread' 
      ? 'Świetnie! Jesteś na bieżąco ze wszystkimi sprawami.' 
      : 'Nie znaleziono powiadomień spełniających kryteria wybranego filtru.';

    return `
      <div class="notifications-empty-state">
        <div class="notifications-empty-icon">🔔</div>
        <h3>${tabLabels[this.currentTab] || 'Brak powiadomień'}</h3>
        <p>${desc}</p>
      </div>
    `;
  },

  bindEvents() {
    // Tabs filtering
    document.querySelectorAll('.notifications-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTab = btn.dataset.tab;
        this.draw();
      });
    });

    // Mark as read
    document.querySelectorAll('.mark-read-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        try {
          await API.patch(`/notifications/${id}/read`);
          await this.loadData();
          this.draw();
          if (window.refreshNotificationsBadge) window.refreshNotificationsBadge();
        } catch (err) {
          Toast.error('Błąd: ' + err.message);
        }
      });
    });

    // Delete single notification
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        try {
          await API.del(`/notifications/${id}`);
          await this.loadData();
          this.draw();
          if (window.refreshNotificationsBadge) window.refreshNotificationsBadge();
        } catch (err) {
          Toast.error('Błąd: ' + err.message);
        }
      });
    });

    // Mark all read globally
    const markAllReadBtn = document.getElementById('notif-mark-all-read-btn');
    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', async () => {
        try {
          await API.post('/notifications/read-all');
          Toast.success('Oznaczono wszystkie powiadomienia jako przeczytane');
          await this.loadData();
          this.draw();
          if (window.refreshNotificationsBadge) window.refreshNotificationsBadge();
        } catch (err) {
          Toast.error('Błąd: ' + err.message);
        }
      });
    }

    // Clear all globally
    const clearAllBtn = document.getElementById('notif-clear-all-btn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', async () => {
        if (!confirm('Czy na pewno chcesz usunąć wszystkie swoje powiadomienia? Tej operacji nie można cofnąć.')) return;
        try {
          await API.del('/notifications');
          Toast.success('Wyczyszczono wszystkie powiadomienia');
          await this.loadData();
          this.draw();
          if (window.refreshNotificationsBadge) window.refreshNotificationsBadge();
        } catch (err) {
          Toast.error('Błąd: ' + err.message);
        }
      });
    }
  }
};
