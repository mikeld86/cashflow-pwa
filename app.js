// app.js – main application logic for Cashflow Calculator PWA
// This script manages theming, routing, state persistence and view rendering.

console.log('Cashflow Calculator loaded');

// Grab references to shared DOM elements
const appEl = document.getElementById('app');
const saveStatus = document.getElementById('saveStatus');
const authStatus = document.getElementById('authStatus');
const authButton = document.getElementById('authButton');
const themeToggle = document.getElementById('themeToggle');
const accentContainer = document.getElementById('accentSelect');
const metaTheme = document.querySelector('meta[name="theme-color"]');

// ----------------------
// Theme & Accent handling
// ----------------------

// Define available accent colours. Names map to human‑readable names and hex values.
const ACCENTS = {
  /**
   * Custom colour palette matching the supplied scheme:
   * black:    rich black
   * lavender: lavender (web)
   * pink:     bright pink (Crayola)
   * blue:     palatinate blue
   * purple:   purpureus
   * lime:     lemon lime
   */
  black:    '#000314',
  lavender: '#EBEEFF',
  pink:     '#EF476F',
  blue:     '#1447E1',
  purple:   '#9349C1',
  lime:     '#F2FF49'
};

/**
 * Apply an accent colour to the document root and persist in localStorage.
 * Also update the theme‑color meta tag for browser UI.
 * @param {string} colourKey
 */
function setAccent(colourKey) {
  const value = ACCENTS[colourKey] || ACCENTS.black;
  document.documentElement.setAttribute('data-accent', colourKey);
  localStorage.setItem('accent', colourKey);
  // update theme colour to accent for standalone browser UI
  if (metaTheme) metaTheme.setAttribute('content', value);
  // highlight selected swatch
  [...accentContainer.children].forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === colourKey);
  });
}

/**
 * Toggle between light and dark themes and persist to localStorage.
 */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeButton(next);
}

/**
 * Update the theme toggle button's icon based on the current theme.
 * @param {string} theme
 */
function updateThemeButton(theme) {
  // Use emoji for simplicity: sun for light, moon for dark
  themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

// Initialize theme and accent from stored preferences or defaults
(function initPreferences() {
  const storedAccent = localStorage.getItem('accent') || 'black';
  const storedTheme = localStorage.getItem('theme') || 'light';
  // Create swatch buttons in the accent container
  accentContainer.innerHTML = '';
  Object.keys(ACCENTS).forEach(key => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.color = key;
    btn.className = 'swatch';
    btn.style.setProperty('--swatch-colour', ACCENTS[key]);
    btn.addEventListener('click', () => setAccent(key));
    accentContainer.appendChild(btn);
  });
  setAccent(storedAccent);
  document.documentElement.setAttribute('data-theme', storedTheme);
  updateThemeButton(storedTheme);
})();

themeToggle.addEventListener('click', () => toggleTheme());

// ----------------------
// Application state
// ----------------------

/** Default state structure for the app. */
const defaultState = {
  cash: { quantities: {} },
  income: {
    cashFlowExtra: [],
    incomeRows: [{ desc: 'Projected Sales (this week)', amount: '' }],
    outgoingThisWeek: [
      { desc: 'Supply Chain', amount: '' },
      { desc: 'Rent', amount: '' },
      { desc: 'Car', amount: '' },
      { desc: 'Phone', amount: '' },
      { desc: 'Utilities', amount: '' },
      { desc: 'Other', amount: '' }
    ],
    outgoingNextWeek: [
      { desc: 'Supply Chain', amount: '' },
      { desc: 'Rent', amount: '' },
      { desc: 'Car', amount: '' },
      { desc: 'Phone', amount: '' },
      { desc: 'Utilities', amount: '' },
      { desc: 'Other', amount: '' }
    ]
  }
};

let state = loadState();

/**
 * Load application state from localStorage or return default state.
 * @returns {object}
 */
function loadState() {
  try {
    const raw = localStorage.getItem('state-cashflow');
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return Object.assign(structuredClone(defaultState), parsed);
  } catch {
    return structuredClone(defaultState);
  }
}

/** Persist the current state to localStorage and show saving status. */
function saveState() {
  try {
    localStorage.setItem('state-cashflow', JSON.stringify(state));
    indicateSaving();
  } catch (err) {
    console.error('Error saving state', err);
    saveStatus.textContent = 'Error saving';
  }
}

/** Update the save badge to indicate saving or saved. */
function indicateSaving() {
  // Show a saving indicator immediately
  saveStatus.textContent = 'Saving…';
  clearTimeout(window.__saveTimer);
  window.__saveTimer = setTimeout(() => {
    // Append a timestamp to the saved message for better context. The time is
    // formatted as HH:MM based on the user’s locale.
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    saveStatus.textContent = `Saved • ${timeStr}`;
  }, 500);
}

// ----------------------
// Utility functions
// ----------------------

// Denominations for notes and coins in AUD
const NOTE_DENOMS = [100, 50, 20, 10, 5];
const COIN_DENOMS = [2, 1, 0.5, 0.2, 0.1, 0.05];

/**
 * Compute subtotals for notes and coins and overall cash total.
 * @returns {{notesSubtotal: number, coinsSubtotal: number, total: number}}
 */
function cashTotals() {
  const q = state.cash.quantities || {};
  const sum = (arr) => arr.reduce((acc, d) => acc + (Number(q[String(d)] || 0) * d), 0);
  const notesSubtotal = sum(NOTE_DENOMS);
  const coinsSubtotal = sum(COIN_DENOMS);
  return { notesSubtotal, coinsSubtotal, total: notesSubtotal + coinsSubtotal };
}

/**
 * Dispatch a custom event when cash totals change so other views can update.
 */
function dispatchCashUpdate() {
  const detail = cashTotals();
  window.dispatchEvent(new CustomEvent('cash:updated', { detail }));
}

/**
 * Sum numeric amounts from an array of objects with an `amount` property.
 * @param {Array<{amount: string}>} arr
 * @returns {number}
 */
function sumAmounts(arr) {
  return arr.reduce((total, item) => {
    const val = parseFloat(item.amount);
    return total + (isFinite(val) ? val : 0);
  }, 0);
}

// ----------------------
// Rendering functions
// ----------------------

/** Render the home page. */
function renderHome() {
  appEl.innerHTML = `
    <h2>Welcome</h2>
    <p>Manage your cash flow, track income and expenses, and stay on top of your finances. Your data is saved locally and syncs when online.</p>
    <button class="icon-btn" id="exportCsv" aria-label="Export CSV">⬇️</button>
  `;
}

/** Render the Cash Calculator page. */
function renderCashPage() {
  const { notesSubtotal, coinsSubtotal, total } = cashTotals();
  const row = (d) => {
    const qty = state.cash.quantities[String(d)] || '';
    const lineTotal = qty ? (Number(qty) * d) : 0;
    return `
      <div class="row" data-denom="${d}">
        <div class="label">$${d.toFixed(2)}</div>
        <input class="qty" type="number" min="0" step="1" inputmode="numeric" value="${qty}" aria-label="Quantity for ${d}">
        <div class="value">$${lineTotal.toFixed(2)}</div>
      </div>
    `;
  };
  appEl.innerHTML = `
    <h2>Cash Calculator</h2>
    <section class="section">
      <h3>Notes</h3>
      ${NOTE_DENOMS.map(row).join('')}
      <div class="row subtotals"><div></div><div class="label">Subtotal</div><div class="value" id="notesSubtotal">$${notesSubtotal.toFixed(2)}</div></div>
    </section>
    <section class="section">
      <h3>Coins</h3>
      ${COIN_DENOMS.map(row).join('')}
      <div class="row subtotals"><div></div><div class="label">Subtotal</div><div class="value" id="coinsSubtotal">$${coinsSubtotal.toFixed(2)}</div></div>
    </section>
    <section class="section">
      <div class="row subtotals"><div></div><div class="label">Total Cash</div><div class="value" id="cashTotal">$${total.toFixed(2)}</div></div>
    </section>
    <div class="controls mt">
      <button class="icon-btn" id="clearCash" aria-label="Clear all quantities">🗑️</button>
    </div>
  `;
  // Wire quantity inputs
  appEl.querySelectorAll('input.qty').forEach(input => {
    input.addEventListener('input', () => {
      const denom = Number(input.closest('.row').dataset.denom);
      state.cash.quantities[String(denom)] = input.value === '' ? '' : Math.max(0, Math.floor(Number(input.value)));
      saveState();
      // Update line and subtotals
      const qtyVal = Number(state.cash.quantities[String(denom)] || 0);
      input.closest('.row').querySelector('.value').textContent = '$' + (qtyVal * denom).toFixed(2);
      const totals = cashTotals();
      appEl.querySelector('#notesSubtotal').textContent = '$' + totals.notesSubtotal.toFixed(2);
      appEl.querySelector('#coinsSubtotal').textContent = '$' + totals.coinsSubtotal.toFixed(2);
      appEl.querySelector('#cashTotal').textContent = '$' + totals.total.toFixed(2);
      dispatchCashUpdate();
    });
  });
  // Clear button
  const clearBtn = document.getElementById('clearCash');
  clearBtn.addEventListener('click', () => {
    NOTE_DENOMS.concat(COIN_DENOMS).forEach(d => state.cash.quantities[String(d)] = '');
    saveState();
    renderCashPage();
    dispatchCashUpdate();
  });
}

/** Render the Income & Expenses page. */
function renderIncomePage() {
  const totals = cashTotals();
  // Build rows for a given section
  function buildRows(arr, sectionKey) {
    return arr.map((row, idx) => `
      <div class="row" data-section="${sectionKey}" data-index="${idx}">
        <input class="desc" placeholder="Description" value="${row.desc || ''}">
        <input class="amount" type="number" step="0.01" inputmode="decimal" placeholder="Amount" value="${row.amount || ''}">
        <!-- Use a lightweight text button with a simple × glyph for row removal -->
        <button class="text-btn remove-row" aria-label="Remove row">×</button>
      </div>
    `).join('');
  }
  appEl.innerHTML = `
    <h2>Income &amp; Expenses</h2>
    <section class="section">
      <header>
        <h3>Cash Flow</h3>
        <div class="controls">
          <!-- Use text buttons for adding lines to reduce visual weight -->
          <button class="text-btn add-line" data-action="cashflow" aria-label="Add cash flow line">+</button>
          <button class="text-btn clear-section" data-action="cashflow">Clear</button>
        </div>
      </header>
      <!-- Display note and coin subtotals. Place the value in the second column for better alignment -->
      <div class="row no-remove">
        <div class="badge-inline">Notes</div>
        <div class="value">$${totals.notesSubtotal.toFixed(2)}</div>
        <div></div>
      </div>
      <div class="row no-remove">
        <div class="badge-inline">Coins</div>
        <div class="value">$${totals.coinsSubtotal.toFixed(2)}</div>
        <div></div>
      </div>
      ${buildRows(state.income.cashFlowExtra, 'cashFlowExtra')}
    </section>

    <section class="section">
      <header>
        <h3>Income</h3>
        <div class="controls">
          <button class="text-btn add-line" data-action="income" aria-label="Add income line">+</button>
          <button class="text-btn clear-section" data-action="income">Clear</button>
        </div>
      </header>
      ${buildRows(state.income.incomeRows, 'incomeRows')}
    </section>

    <section class="section">
      <header>
        <h3>Outgoing – This week</h3>
        <div class="controls">
          <button class="text-btn add-line" data-action="out-this" aria-label="Add outgoing line">+</button>
          <button class="text-btn clear-section" data-action="out-this">Clear</button>
        </div>
      </header>
      ${buildRows(state.income.outgoingThisWeek, 'outgoingThisWeek')}
    </section>

    <section class="section">
      <header>
        <h3>Outgoing – Next week</h3>
        <div class="controls">
          <button class="text-btn add-line" data-action="out-next" aria-label="Add outgoing line">+</button>
          <button class="text-btn clear-section" data-action="out-next">Clear</button>
        </div>
      </header>
      ${buildRows(state.income.outgoingNextWeek, 'outgoingNextWeek')}
    </section>
  `;
  // Hook up add buttons
  appEl.querySelectorAll('button.add-line').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'cashflow') state.income.cashFlowExtra.push({ desc: '', amount: '' });
      if (action === 'income')   state.income.incomeRows.push({ desc: '', amount: '' });
      if (action === 'out-this') state.income.outgoingThisWeek.push({ desc: '', amount: '' });
      if (action === 'out-next') state.income.outgoingNextWeek.push({ desc: '', amount: '' });
      saveState();
      renderIncomePage();
    });
  });
  // Hook up clear section buttons
  appEl.querySelectorAll('button.clear-section').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'cashflow') {
        state.income.cashFlowExtra = [];
      }
      if (action === 'income') {
        state.income.incomeRows = [{ desc: 'Projected Sales (this week)', amount: '' }];
      }
      if (action === 'out-this') {
        state.income.outgoingThisWeek = defaultState.income.outgoingThisWeek.map(row => ({ ...row }));
      }
      if (action === 'out-next') {
        state.income.outgoingNextWeek = defaultState.income.outgoingNextWeek.map(row => ({ ...row }));
      }
      saveState();
      renderIncomePage();
    });
  });
  // Hook up remove buttons
  appEl.querySelectorAll('button.remove-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const rowEl = btn.closest('.row');
      const sectionKey = rowEl.dataset.section;
      const idx = Number(rowEl.dataset.index);
      if (Array.isArray(state.income[sectionKey])) {
        state.income[sectionKey].splice(idx, 1);
        saveState();
        renderIncomePage();
      }
    });
  });
  // Hook up input updates
  appEl.querySelectorAll('.row').forEach(row => {
    const sectionKey = row.dataset.section;
    const idx = Number(row.dataset.index);
    if (!sectionKey) return;
    const descInput = row.querySelector('input.desc');
    const amtInput = row.querySelector('input.amount');
    if (descInput) descInput.addEventListener('input', () => {
      state.income[sectionKey][idx].desc = descInput.value;
      saveState();
    });
    if (amtInput) amtInput.addEventListener('input', () => {
      state.income[sectionKey][idx].amount = amtInput.value;
      saveState();
    });
  });
  // Update notes/coins totals when cash changes
  const updateCashTotals = () => {
    const totals = cashTotals();
    appEl.querySelectorAll('.section .row .badge-inline').forEach((badge, index) => {
      // nothing to update here; totals are displayed separately below
    });
    const noteVal = appEl.querySelectorAll('.section .row .value')[0];
    const coinVal = appEl.querySelectorAll('.section .row .value')[1];
    if (noteVal) noteVal.textContent = '$' + totals.notesSubtotal.toFixed(2);
    if (coinVal) coinVal.textContent = '$' + totals.coinsSubtotal.toFixed(2);
  };
  window.addEventListener('cash:updated', updateCashTotals);
}

/** Render the summary page showing this week and next week balances. */
function renderSummary() {
  const cash = cashTotals();
  const incomeTotal = sumAmounts(state.income.incomeRows);
  const expThis = sumAmounts(state.income.outgoingThisWeek);
  const expNext = sumAmounts(state.income.outgoingNextWeek);
  // This week's remaining after cash + income - expenses
  const thisRemaining = cash.total + incomeTotal - expThis;
  // Next week's starting cash = thisRemaining
  const nextStart = thisRemaining;
  const nextRemaining = nextStart + incomeTotal - expNext;
  // Helper to format currency and mark negatives with a class
  const fmt = (n) => {
    const val = n.toFixed(2);
    const cls = n < 0 ? 'negative' : '';
    return `<span class="value ${cls}">$${val}</span>`;
  };
  appEl.innerHTML = `
    <h2>Summary</h2>
    <div class="summary-grid">
      <div class="summary-col">
        <h3>This Week</h3>
        <div class="summary-row"><span>Cash on hand</span>${fmt(cash.total)}</div>
        <div class="summary-row"><span>Income</span>${fmt(incomeTotal)}</div>
        <div class="summary-row"><span>Expenses</span>${fmt(-expThis)}</div>
        <div class="summary-row total"><span>Remaining</span>${fmt(thisRemaining)}</div>
      </div>
      <div class="summary-col">
        <h3>Next Week</h3>
        <div class="summary-row"><span>Cash on hand</span>${fmt(nextStart)}</div>
        <div class="summary-row"><span>Income</span>${fmt(incomeTotal)}</div>
        <div class="summary-row"><span>Expenses</span>${fmt(-expNext)}</div>
        <div class="summary-row total"><span>Remaining</span>${fmt(nextRemaining)}</div>
      </div>
    </div>
  `;
}

// ----------------------
// Router
// ----------------------

const navLinks = [...document.querySelectorAll('[data-route]')];

/** Activate the correct nav item and render the matching page. */
function setActiveRoute() {
  const hash = location.hash || '#/';
  navLinks.forEach(a => {
    const route = '#' + a.dataset.route;
    const active = hash.startsWith(route);
    a.classList.toggle('active', active);
    a.setAttribute('aria-current', active ? 'page' : 'false');
  });
  const route = hash.replace('#', '');
  if (route === '/cash') return renderCashPage();
  if (route === '/income') return renderIncomePage();
  if (route === '/summary') return renderSummary();
  return renderHome();
}
window.addEventListener('hashchange', setActiveRoute);

// initial render
setActiveRoute();

// ----------------------
// CSV Export (demo)
// ----------------------
function exportCSV() {
  // This is a demonstration of exporting dummy data; adjust as needed
  const rows = [
    ['Date','Description','Debit','Credit','Balance'],
    ['2025-08-01','Opening Balance','','','0.00'],
    ['2025-08-02','Coffee','4.50','','-4.50'],
    ['2025-08-02','Salary','','1500.00','1495.50']
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cashflow.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  indicateSaving();
}
document.body.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'exportCsv') exportCSV();
});

// ----------------------
// Supabase authentication (optional)
// ----------------------
let supabase = null;
function initSupabase() {
  try {
    if (window.ENV && window.ENV.SUPABASE_URL && window.ENV.SUPABASE_ANON_KEY && window.supabase) {
      supabase = window.supabase.createClient(window.ENV.SUPABASE_URL, window.ENV.SUPABASE_ANON_KEY);
      supabase.auth.getSession().then(({ data }) => {
        updateAuthUI(!!data?.session?.user);
      });
      supabase.auth.onAuthStateChange((_event, session) => {
        updateAuthUI(!!session?.user);
      });
    }
  } catch (e) {
    console.warn('Supabase not configured', e);
  }
}
function updateAuthUI(signedIn) {
  authStatus.textContent = signedIn ? 'Signed in' : 'Signed out';
  authButton.textContent = signedIn ? '🚪' : '🔑';
  authButton.setAttribute('aria-label', signedIn ? 'Sign out' : 'Sign in');
}
authButton.addEventListener('click', async () => {
  if (!supabase) {
    alert('Supabase not configured. Please configure SUPABASE_URL and SUPABASE_ANON_KEY.');
    return;
  }
  const isSignOut = authButton.textContent !== '🔑';
  if (isSignOut) {
    await supabase.auth.signOut();
    return;
  }
  const email = prompt('Enter your email for magic link sign-in:');
  if (!email) return;
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) alert(error.message);
  else alert('Check your email for a magic link.');
});
initSupabase();

// ----------------------
// Listen for offline events (optional)
// ----------------------
self.addEventListener && self.addEventListener('offline', () => {
  saveStatus.textContent = 'Offline';
});