// ==UserScript==
// @name         Queue Dashboard - Auto Capture
// @namespace    queue-dashboard
// @version      1.0
// @description  Automatically captures queue counts from Approvals, SIM, and Salesforce reports
// @match        https://approvals.amazon.com/Approvals/pending*
// @match        https://sim.amazon.com/issues/search*
// @match        https://amazonshipping.lightning.force.com/lightning/r/Report/00Oat000000FchiEAC/*
// @match        https://amazonshipping.lightning.force.com/lightning/r/Report/00Oat000001DclFEAS/*
// @match        https://amazonshipping.lightning.force.com/lightning/r/Report/00ODo000002LVNHMA4/*
// @match        https://amazonshipping.lightning.force.com/reports/lightningReportApp.app*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'queueDashboard_autoCapture';

    // Get current captured data or create fresh
    function getCapturedData() {
        const today = new Date().toISOString().split('T')[0];
        const stored = localStorage.getItem(STORAGE_KEY);
        let data = stored ? JSON.parse(stored) : {};

        // Reset if it's a new day
        if (data.date !== today) {
            data = {
                date: today,
                pendingApproval: 0,
                sim: 0,
                creditAutomation: 0,
                manualReviews: 0,
                s360Update: 0,
                timestamp: null
            };
        }
        return data;
    }

    // Save captured data
    function saveCapturedData(data) {
        data.timestamp = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        console.log('[Queue Dashboard] Data saved:', data);
    }

    // Show a small notification on the page
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #4ecdc4;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            z-index: 99999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: opacity 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ========== APPROVALS (approvals.amazon.com) ==========
    function captureApprovals() {
        // Wait for page to fully load
        setTimeout(() => {
            // Look for "Pending My Approval" tab with count
            const pendingTab = document.querySelector('[data-testid="PENDING_NOW"]');
            if (pendingTab) {
                const countDiv = pendingTab.querySelector('div[style*="color: red"], div:not([style])');
                // Try to find the number in the tab
                const tabText = pendingTab.textContent;
                const match = tabText.match(/Pending My Approval\s*(\d+)/);
                if (match) {
                    const count = parseInt(match[1]);
                    const data = getCapturedData();
                    data.pendingApproval = count;
                    saveCapturedData(data);
                    showNotification(`Queue Dashboard: Pending Approval = ${count}`);
                    return;
                }
            }

            // Fallback: search all tab content
            const allTabs = document.querySelectorAll('.awsui-tabs-tab');
            for (const tab of allTabs) {
                const text = tab.textContent;
                if (text.includes('Pending My Approval')) {
                    const match = text.match(/(\d+)/);
                    if (match) {
                        const count = parseInt(match[1]);
                        const data = getCapturedData();
                        data.pendingApproval = count;
                        saveCapturedData(data);
                        showNotification(`Queue Dashboard: Pending Approval = ${count}`);
                        return;
                    }
                }
            }

            console.log('[Queue Dashboard] Could not find Pending Approval count');
        }, 3000);
    }

    // ========== SIM (sim.amazon.com) ==========
    function captureSIM() {
        setTimeout(() => {
            // Look for the result count in the search results
            // SIM typically shows "X issues" or a count in the search header
            const countSelectors = [
                '.search-result-count',
                '.results-count',
                '.issue-count',
                '[data-test="search-result-count"]',
                '.search-header-count'
            ];

            for (const selector of countSelectors) {
                const el = document.querySelector(selector);
                if (el) {
                    const match = el.textContent.match(/(\d+)/);
                    if (match) {
                        const count = parseInt(match[1]);
                        const data = getCapturedData();
                        data.sim = count;
                        saveCapturedData(data);
                        showNotification(`Queue Dashboard: SIM = ${count}`);
                        return;
                    }
                }
            }

            // Fallback: count the issue rows in the list
            const issueRows = document.querySelectorAll('.issue-list-item, .search-result-item, tr.issue-row');
            if (issueRows.length > 0) {
                const data = getCapturedData();
                data.sim = issueRows.length;
                saveCapturedData(data);
                showNotification(`Queue Dashboard: SIM = ${issueRows.length}`);
                return;
            }

            // Another fallback: look for text like "1-25 of 42"
            const body = document.body.textContent;
            const paginationMatch = body.match(/of\s+(\d+)\s+issue/i);
            if (paginationMatch) {
                const count = parseInt(paginationMatch[1]);
                const data = getCapturedData();
                data.sim = count;
                saveCapturedData(data);
                showNotification(`Queue Dashboard: SIM = ${count}`);
                return;
            }

            console.log('[Queue Dashboard] Could not find SIM count. Please check the page.');
        }, 5000);
    }

    // ========== SALESFORCE REPORTS ==========
    function captureSalesforceReport() {
        setTimeout(() => {
            const url = window.location.href;

            // Determine which report this is
            let field = '';
            if (url.includes('00Oat000000FchiEAC')) {
                field = 'creditAutomation';
            } else if (url.includes('00Oat000001DclFEAS')) {
                field = 'manualReviews';
            } else if (url.includes('00ODo000002LVNHMA4')) {
                field = 's360Update';
            }

            // Also check reportId parameter
            if (!field) {
                const params = new URLSearchParams(window.location.search);
                const reportId = params.get('reportId');
                if (reportId === '00Oat000000FchiEAC') field = 'creditAutomation';
                else if (reportId === '00Oat000001DclFEAS') field = 'manualReviews';
                else if (reportId === '00ODo000002LVNHMA4') field = 's360Update';
            }

            if (!field) {
                console.log('[Queue Dashboard] Unknown Salesforce report');
                return;
            }

            // Try to find the record count in the report
            // Salesforce reports show "X rows" or "Grand Totals (X records)"
            const countSelectors = [
                '.reportOutput .grandTotal',
                '.report-grand-total',
                '[data-aura-class="reportOutput"] .rowCount',
                '.slds-text-body--small',
                '.test-id__section-header-count',
                '.report-output-header'
            ];

            for (const selector of countSelectors) {
                const els = document.querySelectorAll(selector);
                for (const el of els) {
                    const match = el.textContent.match(/(\d+)\s*(?:row|record|item)/i);
                    if (match) {
                        const count = parseInt(match[1]);
                        const data = getCapturedData();
                        data[field] = count;
                        saveCapturedData(data);
                        const fieldNames = {
                            creditAutomation: 'Credit Automation',
                            manualReviews: 'Manual Reviews',
                            s360Update: 'S360 Update'
                        };
                        showNotification(`Queue Dashboard: ${fieldNames[field]} = ${count}`);
                        return;
                    }
                }
            }

            // Fallback: look for row count anywhere on the page
            const allText = document.body.innerText;
            const rowMatch = allText.match(/(\d+)\s*rows?/i);
            if (rowMatch) {
                const count = parseInt(rowMatch[1]);
                const data = getCapturedData();
                data[field] = count;
                saveCapturedData(data);
                const fieldNames = {
                    creditAutomation: 'Credit Automation',
                    manualReviews: 'Manual Reviews',
                    s360Update: 'S360 Update'
                };
                showNotification(`Queue Dashboard: ${fieldNames[field]} = ${count}`);
                return;
            }

            // Check if report shows "No data" 
            if (allText.includes('No data') || allText.includes('no results')) {
                const data = getCapturedData();
                data[field] = 0;
                saveCapturedData(data);
                const fieldNames = {
                    creditAutomation: 'Credit Automation',
                    manualReviews: 'Manual Reviews',
                    s360Update: 'S360 Update'
                };
                showNotification(`Queue Dashboard: ${fieldNames[field]} = 0 (no data)`);
                return;
            }

            console.log('[Queue Dashboard] Could not find report count for:', field);
        }, 8000); // Salesforce takes longer to load
    }

    // ========== ROUTE TO CORRECT HANDLER ==========
    const currentURL = window.location.href;

    if (currentURL.includes('approvals.amazon.com')) {
        captureApprovals();
    } else if (currentURL.includes('sim.amazon.com')) {
        captureSIM();
    } else if (currentURL.includes('amazonshipping.lightning.force.com')) {
        captureSalesforceReport();
    }

})();
