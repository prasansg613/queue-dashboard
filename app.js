// Queue Dashboard - Main Application Logic
// Data is fetched from GitHub repo (data.json)

const GITHUB_OWNER = 'prasansg613';
const GITHUB_REPO = 'queue-dashboard';
const DATA_FILE = 'data.json';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE}`;
const RAW_DATA_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${DATA_FILE}`;

// DOM Elements
const form = document.getElementById('queue-form');
const entryDateInput = document.getElementById('entry-date');
const pendingApprovalInput = document.getElementById('pending-approval');
const simInput = document.getElementById('sim');
const creditAutomationInput = document.getElementById('credit-automation');
const manualReviewsInput = document.getElementById('manual-reviews');
const s360UpdateInput = document.getElementById('s360-update');
const historyBody = document.getElementById('history-body');
const emptyState = document.getElementById('empty-state');
const btnClearForm = document.getElementById('btn-clear-form');
const btnExport = document.getElementById('btn-export');
const btnToggleForm = document.getElementById('btn-toggle-form');
const lastUpdatedEl = document.getElementById('last-updated');

// Display elements
const displayPending = document.getElementById('display-pending-approval');
const displaySim = document.getElementById('display-sim');
const displayAutomation = document.getElementById('display-credit-automation');
const displayManual = document.getElementById('display-manual-reviews');
const displayS360 = document.getElementById('display-s360-update');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setDefaultDate();
    loadDataFromGitHub();
});

// Toggle form visibility
btnToggleForm.addEventListener('click', () => {
    form.classList.toggle('hidden');
    btnToggleForm.textContent = form.classList.contains('hidden') ? 'Show Form' : 'Hide Form';
});

// Set today's date as default
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    entryDateInput.value = today;
}

// Fetch data from GitHub
async function loadDataFromGitHub() {
    try {
        // Add cache-busting parameter
        const response = await fetch(RAW_DATA_URL + '?t=' + Date.now());
        if (response.ok) {
            const data = await response.json();
            renderCards(data);
            renderTable(data);
            lastUpdatedEl.textContent = `Last refreshed: ${new Date().toLocaleString()}`;
        } else {
            console.error('Failed to fetch data:', response.status);
            renderCards([]);
            renderTable([]);
        }
    } catch (error) {
        console.error('Error loading data:', error);
        renderCards([]);
        renderTable([]);
    }
}

// Update summary cards with today's data (or most recent)
function renderCards(data) {
    const today = new Date().toISOString().split('T')[0];
    let displayEntry = data.find(entry => entry.date === today);

    // If no today's data, show most recent
    if (!displayEntry && data.length > 0) {
        const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
        displayEntry = sorted[0];
    }

    if (displayEntry) {
        displayPending.textContent = displayEntry.pendingApproval || 0;
        displaySim.textContent = displayEntry.sim || 0;
        displayAutomation.textContent = displayEntry.creditAutomation || 0;
        displayManual.textContent = displayEntry.manualReviews || 0;
        displayS360.textContent = displayEntry.s360Update || 0;
    } else {
        displayPending.textContent = '--';
        displaySim.textContent = '--';
        displayAutomation.textContent = '--';
        displayManual.textContent = '--';
        displayS360.textContent = '--';
    }
}

// Render the history table
function renderTable(data) {
    historyBody.innerHTML = '';

    if (data.length === 0) {
        emptyState.style.display = 'block';
        document.getElementById('history-table').style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    document.getElementById('history-table').style.display = 'table';

    // Sort by date descending
    const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(entry => {
        const total = (entry.pendingApproval || 0) + (entry.sim || 0) +
                      (entry.creditAutomation || 0) + (entry.manualReviews || 0) +
                      (entry.s360Update || 0);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(entry.date)}</td>
            <td>${entry.pendingApproval || 0}</td>
            <td>${entry.sim || 0}</td>
            <td>${entry.creditAutomation || 0}</td>
            <td>${entry.manualReviews || 0}</td>
            <td>${entry.s360Update || 0}</td>
            <td><strong>${total}</strong></td>
            <td>${entry.updatedBy || '--'}</td>
        `;
        historyBody.appendChild(row);
    });
}

// Format date for display
function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Handle form submission (manual entry)
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showToast('Saving... please wait');

    const entry = {
        date: entryDateInput.value,
        pendingApproval: parseInt(pendingApprovalInput.value) || 0,
        sim: parseInt(simInput.value) || 0,
        creditAutomation: parseInt(creditAutomationInput.value) || 0,
        manualReviews: parseInt(manualReviewsInput.value) || 0,
        s360Update: parseInt(s360UpdateInput.value) || 0,
        updatedBy: 'manual',
        timestamp: new Date().toISOString()
    };

    try {
        // Fetch current data
        const response = await fetch(RAW_DATA_URL + '?t=' + Date.now());
        let data = [];
        if (response.ok) {
            data = await response.json();
        }

        // Update or add entry
        const existingIndex = data.findIndex(d => d.date === entry.date);
        if (existingIndex !== -1) {
            data[existingIndex] = entry;
        } else {
            data.push(entry);
        }

        // Note: Manual form can't push to GitHub without token
        // Save locally and show message
        localStorage.setItem('queueDashboardLocal', JSON.stringify(data));
        renderCards(data);
        renderTable(data);
        resetForm();
        showToast('Entry saved locally. Use the userscript for auto-sync to GitHub.');
    } catch (error) {
        console.error('Error saving:', error);
        showToast('Error saving data.');
    }
});

// Reset form
function resetForm() {
    pendingApprovalInput.value = '';
    simInput.value = '';
    creditAutomationInput.value = '';
    manualReviewsInput.value = '';
    s360UpdateInput.value = '';
    setDefaultDate();
}

// Clear form button
btnClearForm.addEventListener('click', resetForm);

// Export to CSV
btnExport.addEventListener('click', async () => {
    try {
        const response = await fetch(RAW_DATA_URL + '?t=' + Date.now());
        const data = await response.json();

        if (data.length === 0) {
            showToast('No data to export.');
            return;
        }

        const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));

        const headers = ['Date', 'Pending Approval', 'SIM', 'Credit Automation - Comments',
                         'Credit Check Manual Reviews', 'Credit Check - S360 Update', 'Total', 'Updated By'];

        const rows = sorted.map(entry => {
            const total = (entry.pendingApproval || 0) + (entry.sim || 0) +
                          (entry.creditAutomation || 0) + (entry.manualReviews || 0) +
                          (entry.s360Update || 0);
            return [entry.date, entry.pendingApproval || 0, entry.sim || 0,
                    entry.creditAutomation || 0, entry.manualReviews || 0,
                    entry.s360Update || 0, total, entry.updatedBy || ''].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `queue-dashboard-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        showToast('CSV exported!');
    } catch (error) {
        showToast('Error exporting data.');
    }
});

// Auto-refresh every 5 minutes
setInterval(loadDataFromGitHub, 5 * 60 * 1000);

// Toast notification
function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
