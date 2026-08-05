// ==UserScript==
// @name         Queue Dashboard - Auto Capture & Sync to GitHub
// @namespace    queue-dashboard
// @version      2.0
// @description  Captures queue counts from Approvals, SIM, and Salesforce and syncs to GitHub
// @match        https://approvals.amazon.com/Approvals/pending*
// @match        https://sim.amazon.com/issues/search*
// @match        https://amazonshipping.lightning.force.com/lightning/r/Report/00Oat000000FchiEAC/*
// @match        https://amazonshipping.lightning.force.com/lightning/r/Report/00Oat000001DclFEAS/*
// @match        https://amazonshipping.lightning.force.com/lightning/r/Report/00ODo000002LVNHMA4/*
// @match        https://amazonshipping.lightning.force.com/reports/lightningReportApp.app*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.github.com
// ==/UserScript==

(function() {
    'use strict';

    // ====== CONFIGURATION ======
    const GITHUB_TOKEN = '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';
    const GITHUB_OWNER = 'prasansg613';
    const GITHUB_REPO = 'queue-dashboard';
    const DATA_FILE = 'data.json';
    const API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE}`;
    // ===========================

    // Get today's date
    function getToday() {
        return new Date().toISOString().split('T')[0];
    }

    // Show notification on page
    function showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: ${isError ? '#ff6b6b' : '#4ecdc4'};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            z-index: 99999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: opacity 0.3s ease;
            max-width: 400px;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // Fetch current data.json from GitHub
    async function fetchGitHubData() {
        try {
            const response = await fetch(API_URL, {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.status === 404) {
                // File doesn't exist yet, return empty
                return { data: [], sha: null };
            }

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const fileInfo = await response.json();
            const content = atob(fileInfo.content);
            const data = JSON.parse(content);
            return { data, sha: fileInfo.sha };
        } catch (error) {
            console.error('[Queue Dashboard] Error fetching GitHub data:', error);
            return { data: [], sha: null };
        }
    }

    // Push updated data to GitHub
    async function pushToGitHub(data, sha) {
        try {
            const content = btoa(JSON.stringify(data, null, 2));
            const body = {
                message: `Update queue data - ${getToday()}`,
                content: content
            };

            if (sha) {
                body.sha = sha;
            }

            const response = await fetch(API_URL, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error('[Queue Dashboard] Error pushing to GitHub:', error);
            showNotification(`Error saving to GitHub: ${error.message}`, true);
            return false;
        }
    }

    // Save a captured value to GitHub
    async function saveCapturedValue(field, value) {
        const today = getToday();

        // Fetch current data from GitHub
        const { data, sha } = await fetchGitHubData();

        // Find or create today's entry
        let todayIndex = data.findIndex(entry => entry.date === today);

        if (todayIndex === -1) {
            // Create new entry for today
            data.push({
                date: today,
                pendingApproval: 0,
                sim: 0,
                creditAutomation: 0,
                manualReviews: 0,
                s360Update: 0,
                updatedBy: 'userscript',
                timestamp: new Date().toISOString()
            });
            todayIndex = data.length - 1;
        }

        // Update the specific field
        data[todayIndex][field] = value;
        data[todayIndex].timestamp = new Date().toISOString();
        data[todayIndex].updatedBy = 'userscript';

        // Push to GitHub
        const success = await pushToGitHub(data, sha);

        if (success) {
            const fieldNames = {
                pendingApproval: 'Pending Approval',
                sim: 'SIM',
                creditAutomation: 'Credit Automation',
                manualReviews: 'Manual Reviews',
                s360Update: 'S360 Update'
            };
            showNotification(`✓ ${fieldNames[field]} = ${value} → Saved to GitHub!`);
        }
    }

    // ========== APPROVALS (approvals.amazon.com) ==========
    function captureApprovals() {
        setTimeout(() => {
            // Look for "Pending My Approval" tab with count
            const allTabs = document.querySelectorAll('.awsui-tabs-tab, [role="presentation"]');
            for (const tab of allTabs) {
                const text = tab.textContent;
                if (text.includes('Pending My Approval')) {
                    const match = text.match(/Pending My Approval\s*(\d+)/);
                    if (match) {
                        const count = parseInt(match[1]);
                        saveCapturedValue('pendingApproval', count);
                        return;
                    }
                    // Try just finding any number after the text
                    const numMatch = text.match(/(\d+)/);
                    if (numMatch) {
                        const count = parseInt(numMatch[1]);
                        saveCapturedValue('pendingApproval', count);
                        return;
                    }
                }
            }

            // Fallback: look in inner HTML for the specific structure
            const pending = document.querySelector('[data-testid="PENDING_NOW"]');
            if (pending) {
                const numMatch = pending.textContent.match(/(\d+)/);
                if (numMatch) {
                    saveCapturedValue('pendingApproval', parseInt(numMatch[1]));
                    return;
                }
            }

            showNotification('Could not find Pending Approval count', true);
        }, 5000);
    }

    // ========== SIM (sim.amazon.com) ==========
    function captureSIM() {
        setTimeout(() => {
            // Look for result count in various locations
            const countSelectors = [
                '.search-result-count',
                '.results-count',
                '.issue-count',
                '[data-test="search-result-count"]',
                '.search-header-count',
                '.result-count',
                '.search-results-header'
            ];

            for (const selector of countSelectors) {
                const el = document.querySelector(selector);
                if (el) {
                    const match = el.textContent.match(/(\d+)/);
                    if (match) {
                        saveCapturedValue('sim', parseInt(match[1]));
                        return;
                    }
                }
            }

            // Look for pagination info like "1-25 of 42"
            const body = document.body.innerText;
            const paginationMatch = body.match(/of\s+(\d+)\s+issue/i) ||
                                     body.match(/(\d+)\s+results?/i) ||
                                     body.match(/(\d+)\s+issues?\s+found/i);
            if (paginationMatch) {
                saveCapturedValue('sim', parseInt(paginationMatch[1]));
                return;
            }

            // Count visible issue rows
            const issueRows = document.querySelectorAll(
                '.issue-list-item, .search-result-item, tr.issue-row, .document-list-item'
            );
            if (issueRows.length > 0) {
                saveCapturedValue('sim', issueRows.length);
                return;
            }

            showNotification('Could not find SIM count. Try refreshing the page.', true);
        }, 6000);
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

            // Try to find the record count
            const allText = document.body.innerText;

            // Look for "Total Records" or "Total Records: 282" pattern (shown in report header)
            const totalRecordsMatch = allText.match(/Total\s*Records[:\s]*(\d[\d,]*)/i);
            if (totalRecordsMatch) {
                const count = parseInt(totalRecordsMatch[1].replace(/,/g, ''));
                saveCapturedValue(field, count);
                return;
            }

            // Look for "X rows" pattern
            const rowMatch = allText.match(/(\d[\d,]*)\s*rows?/i);
            if (rowMatch) {
                saveCapturedValue(field, parseInt(rowMatch[1].replace(/,/g, '')));
                return;
            }

            // Look for "Grand Totals (X records)" or "X records"
            const recordMatch = allText.match(/(\d[\d,]*)\s*records?/i);
            if (recordMatch) {
                saveCapturedValue(field, parseInt(recordMatch[1].replace(/,/g, '')));
                return;
            }

            // Look for count in report header like "X items"
            const headerMatch = allText.match(/(\d[\d,]*)\s*items?/i);
            if (headerMatch) {
                saveCapturedValue(field, parseInt(headerMatch[1].replace(/,/g, '')));
                return;
            }

            // Check if "No data" is shown
            if (allText.includes('No data') || allText.includes('no results') ||
                allText.includes('No records')) {
                saveCapturedValue(field, 0);
                return;
            }

            // Count table rows as fallback
            const tableRows = document.querySelectorAll('table tbody tr, .slds-table tbody tr');
            if (tableRows.length > 0) {
                saveCapturedValue(field, tableRows.length);
                return;
            }

            showNotification(`Could not find count for ${field}. Try refreshing.`, true);
        }, 10000); // Salesforce needs more time to load
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
