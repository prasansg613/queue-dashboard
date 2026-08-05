// ==UserScript==
// @name         Queue Dashboard - Auto Capture & Sync to GitHub
// @namespace    queue-dashboard
// @version      2.1
// @description  Captures queue counts and syncs to GitHub
// @match        https://approvals.amazon.com/Approvals/pending*
// @match        https://sim.amazon.com/issues/search*
// @match        https://amazonshipping.lightning.force.com/lightning/r/Report/00Oat000000FchiEAC/*
// @match        https://amazonshipping.lightning.force.com/lightning/r/Report/00Oat000001DclFEAS/*
// @match        https://amazonshipping.lightning.force.com/lightning/r/Report/00ODo000002LVNHMA4/*
// @match        https://amazonshipping.lightning.force.com/reports/lightningReportApp.app*
// @grant        GM_xmlhttpRequest
// @connect      api.github.com
// ==/UserScript==

(function() {
    'use strict';

 const GITHUB_TOKEN = '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';
    const GITHUB_OWNER = 'prasansg613';
    const GITHUB_REPO = 'queue-dashboard';
    const DATA_FILE = 'data.json';
    const API_URL = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + DATA_FILE;

    function getToday() {
        return new Date().toISOString().split('T')[0];
    }

    function showNotification(message, isError) {
        var notification = document.createElement('div');
        notification.style.cssText = 'position:fixed;top:10px;right:10px;background:' + (isError ? '#ff6b6b' : '#4ecdc4') + ';color:white;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:400px;';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(function() {
            notification.style.opacity = '0';
            setTimeout(function() { notification.remove(); }, 300);
        }, 4000);
    }

    function fetchGitHubData(callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: API_URL,
            headers: {
                'Authorization': 'token ' + GITHUB_TOKEN,
                'Accept': 'application/vnd.github.v3+json'
            },
            onload: function(response) {
                if (response.status === 404) {
                    callback([], null);
                    return;
                }
                if (response.status !== 200) {
                    showNotification('GitHub API error: ' + response.status, true);
                    callback([], null);
                    return;
                }
                try {
                    var fileInfo = JSON.parse(response.responseText);
                    var content = atob(fileInfo.content);
                    var data = JSON.parse(content);
                    callback(data, fileInfo.sha);
                } catch (e) {
                    showNotification('Error parsing GitHub data', true);
                    callback([], null);
                }
            },
            onerror: function() {
                showNotification('Network error connecting to GitHub', true);
                callback([], null);
            }
        });
    }

    function pushToGitHub(data, sha, callback) {
        var content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
        var body = { message: 'Update queue data - ' + getToday(), content: content };
        if (sha) { body.sha = sha; }

        GM_xmlhttpRequest({
            method: 'PUT',
            url: API_URL,
            headers: {
                'Authorization': 'token ' + GITHUB_TOKEN,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(body),
            onload: function(response) {
                if (response.status === 200 || response.status === 201) {
                    callback(true);
                } else {
                    showNotification('Error saving: HTTP ' + response.status, true);
                    callback(false);
                }
            },
            onerror: function() {
                showNotification('Network error saving to GitHub', true);
                callback(false);
            }
        });
    }

    function saveCapturedValue(field, value) {
        var today = getToday();
        var fieldNames = { pendingApproval:'Pending Approval', sim:'SIM', creditAutomation:'Credit Automation', manualReviews:'Manual Reviews', s360Update:'S360 Update' };

        showNotification('Capturing ' + fieldNames[field] + ' = ' + value + '...');

        fetchGitHubData(function(data, sha) {
            var todayIndex = -1;
            for (var i = 0; i < data.length; i++) {
                if (data[i].date === today) { todayIndex = i; break; }
            }
            if (todayIndex === -1) {
                data.push({ date:today, pendingApproval:0, sim:0, creditAutomation:0, manualReviews:0, s360Update:0, updatedBy:'userscript', timestamp:'' });
                todayIndex = data.length - 1;
            }
            data[todayIndex][field] = value;
            data[todayIndex].timestamp = new Date().toISOString();
            data[todayIndex].updatedBy = 'userscript';

            pushToGitHub(data, sha, function(success) {
                if (success) {
                    showNotification('✓ ' + fieldNames[field] + ' = ' + value + ' → Saved to GitHub!');
                }
            });
        });
    }

    // ========== APPROVALS ==========
    function captureApprovals() {
        setTimeout(function() {
            var pending = document.querySelector('[data-testid="PENDING_NOW"]');
            if (pending) {
                var match = pending.textContent.match(/(\d+)/);
                if (match) { saveCapturedValue('pendingApproval', parseInt(match[1])); return; }
            }
            var tabs = document.querySelectorAll('.awsui-tabs-tab');
            for (var i = 0; i < tabs.length; i++) {
                if (tabs[i].textContent.indexOf('Pending My Approval') !== -1) {
                    var m = tabs[i].textContent.match(/(\d+)/);
                    if (m) { saveCapturedValue('pendingApproval', parseInt(m[1])); return; }
                }
            }
            showNotification('Could not find Pending Approval count', true);
        }, 5000);
    }

    // ========== SIM ==========
    function captureSIM() {
        setTimeout(function() {
            var body = document.body.innerText;
            var match = body.match(/of\s+(\d+)\s+issue/i) || body.match(/(\d+)\s+results/i) || body.match(/(\d+)\s+issues/i);
            if (match) { saveCapturedValue('sim', parseInt(match[1])); return; }

            var rows = document.querySelectorAll('.issue-list-item, .search-result-item, .document-list-item, tr.issue-row');
            if (rows.length > 0) { saveCapturedValue('sim', rows.length); return; }

            showNotification('Could not find SIM count', true);
        }, 6000);
    }

    // ========== SALESFORCE ==========
    function captureSalesforceReport() {
        setTimeout(function() {
            var url = window.location.href;
            var field = '';
            if (url.indexOf('00Oat000000FchiEAC') !== -1) field = 'creditAutomation';
            else if (url.indexOf('00Oat000001DclFEAS') !== -1) field = 'manualReviews';
            else if (url.indexOf('00ODo000002LVNHMA4') !== -1) field = 's360Update';

            if (!field) {
                var params = new URLSearchParams(window.location.search);
                var reportId = params.get('reportId');
                if (reportId === '00Oat000000FchiEAC') field = 'creditAutomation';
                else if (reportId === '00Oat000001DclFEAS') field = 'manualReviews';
                else if (reportId === '00ODo000002LVNHMA4') field = 's360Update';
            }
            if (!field) return;

            var allText = document.body.innerText;
            var m;

            m = allText.match(/Total\s*Records[:\s]*(\d[\d,]*)/i);
            if (m) { saveCapturedValue(field, parseInt(m[1].replace(/,/g,''))); return; }

            m = allText.match(/(\d[\d,]*)\s*rows?/i);
            if (m) { saveCapturedValue(field, parseInt(m[1].replace(/,/g,''))); return; }

            m = allText.match(/(\d[\d,]*)\s*records?/i);
            if (m) { saveCapturedValue(field, parseInt(m[1].replace(/,/g,''))); return; }

            if (allText.indexOf('No data') !== -1 || allText.indexOf('no results') !== -1) {
                saveCapturedValue(field, 0); return;
            }

            var tableRows = document.querySelectorAll('table tbody tr');
            if (tableRows.length > 0) { saveCapturedValue(field, tableRows.length); return; }

            showNotification('Could not find count for report', true);
        }, 10000);
    }

    // ========== ROUTE ==========
    var url = window.location.href;
    if (url.indexOf('approvals.amazon.com') !== -1) captureApprovals();
    else if (url.indexOf('sim.amazon.com') !== -1) captureSIM();
    else if (url.indexOf('amazonshipping.lightning.force.com') !== -1) captureSalesforceReport();

})();
