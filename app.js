// Queue Dashboard - Main Application Logic
// Data is stored in localStorage and synced via Tampermonkey userscript

const STORAGE_KEY = 'queueDashboardData';

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
    loadAndRender();
    checkForUserscriptData();
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

// Get data from localStorage
function getData() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// Save data to localStorage
function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Check for data pushed by Tampermonkey userscript
function checkForUserscriptData() {
    const userscriptData = localStorage.getItem('queueDashboard_autoCapture');
    if (userscriptData) {
        try {
            const captured = JSON.parse(userscriptData);
            const today = new Date().toISOString().split('T')[0];

            // Only process if captured today
            if (captured.date === today) {
                const data = getData();
                const existingIndex = data.findIndex(d => d.date === today);

                const entry = {
                    date: today,
                    pendingApproval: captured.pendingApproval || 0,
                    sim: captured.sim || 0,
                    creditAutomation: captured.creditAutomation || 0,
                    manualReviews: captured.manualReviews || 0,
                    s360Update: captured.s360Update || 0
                };

                if (existingIndex !== -1) {
                    // Merge: only update fields that have new data
                    const existing = data[existingIndex];
                    entry.pendingApproval = captured.pendingApproval || existing.pendingApproval || 0;
                    entry.sim = captured.sim || existing.sim || 0;
                    entry.creditAutomation = captured.creditAutomation || existing.creditAutomation || 0;
                    entry.manualReviews = captured.manualReviews || existing.manualReviews || 0;
                    entry.s360Update = captured.s360Update || existing.s360Update || 0;
                    data[existingIndex] = entry;
                } else {
                    data.push(entry);
                }

                saveData(data);
                loadAndRender();

                // Update last updated time
                if (captured.timestamp) {
                    lastUpdatedEl.textContent = `Last auto-updated: ${new Date(captured.timestamp).toLocaleString()}`;
                }
            }
        } catch (e) {
            console.error('Error processing userscript data:', e);
        }
    }
}

// Listen for storage events (when userscript updates data in another tab)
window.addEventListener('storage', (e) => {
    if (e.key === 'queueDashboard_autoCapture') {
        checkForUserscriptData();
    }
});

// Load data and render all views
function loadAndRender() {
    const data = getData();
    renderCards(data);
    renderTable(data);
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
        displayPending.textContent = displayEntry.pendingApproval;
        displaySim.textContent = displayEntry.sim;
        displayAutomation.textContent = displayEntry.creditAutomation;
        displayManual.textContent = displayEntry.manualReviews;
        displayS360.textContent = displayEntry.s360Update;
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
            <td><button class="btn-delete" data-date="${entry.date}">Delete</button></td>
        `;
        historyBody.appendChild(row);
    });

    // Add delete event listeners
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const date = e.target.getAttribute('data-date');
            deleteEntry(date);
        });
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

// Handle form submission
form.addEventListener('submit', (e) => {
    e.preventDefault();

    const entry = {
        date: entryDateInput.value,
        pendingApproval: parseInt(pendingApprovalInput.value) || 0,
        sim: parseInt(simInput.value) || 0,
        creditAutomation: parseInt(creditAutomationInput.value) || 0,
        manualReviews: parseInt(manualReviewsInput.value) || 0,
        s360Update: parseInt(s360UpdateInput.value) || 0
    };

    const data = getData();
    const existingIndex = data.findIndex(d => d.date === entry.date);

    if (existingIndex !== -1) {
        data[existingIndex] = entry;
        showToast('Entry updated successfully!');
    } else {
        data.push(entry);
        showToast('Entry saved successfully!');
    }

    saveData(data);
    loadAndRender();
    resetForm();
});

// Delete an entry
function deleteEntry(date) {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    const data = getData();
    const filtered = data.filter(entry => entry.date !== date);
    saveData(filtered);
    loadAndRender();
    showToast('Entry deleted.');
}

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
btnExport.addEventListener('click', () => {
    const data = getData();
    if (data.length === 0) {
        showToast('No data to export.');
        return;
    }

    const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));

    const headers = ['Date', 'Pending Approval', 'SIM', 'Credit Automation - Comments',
                     'Credit Check Manual Reviews', 'Credit Check - S360 Update', 'Total'];

    const rows = sorted.map(entry => {
        const total = (entry.pendingApproval || 0) + (entry.sim || 0) +
                      (entry.creditAutomation || 0) + (entry.manualReviews || 0) +
                      (entry.s360Update || 0);
        return [entry.date, entry.pendingApproval, entry.sim, entry.creditAutomation,
                entry.manualReviews, entry.s360Update, total].join(',');
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
});

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
