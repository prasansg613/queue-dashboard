# Queue Dashboard

Daily team queue tracker for monitoring pending items across multiple systems.

## Queues Tracked

| Queue | Source |
|-------|--------|
| Pending Approval | approvals.amazon.com |
| SIM | sim.amazon.com |
| Credit Automation - Comments | Salesforce Report |
| Credit Check Manual Reviews | Salesforce Report |
| Credit Check - S360 Update | Salesforce Report |

## Setup Instructions

### Step 1: Push to GitHub

```bash
cd "C:\Users\prasansg\Desktop\Queue dasboard"
git init
git add .
git commit -m "Initial commit: Queue Dashboard"
git branch -M main
git remote add origin https://github.com/prasansg613/queue-dashboard.git
git push -u origin main
```

### Step 2: Enable GitHub Pages

1. Go to your repo: https://github.com/prasansg613/queue-dashboard
2. Click **Settings** > **Pages** (left sidebar)
3. Under "Source", select **Deploy from a branch**
4. Choose **main** branch, **/ (root)** folder
5. Click **Save**
6. Your dashboard will be live at: `https://prasansg613.github.io/queue-dashboard/`

### Step 3: Install Tampermonkey Userscript

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Click the Tampermonkey icon > **Create a new script**
3. Delete the template and paste the contents of `userscript.js`
4. Click **File > Save** (or Ctrl+S)

### Step 4: Daily Usage

1. Open these tabs in your browser:
   - https://approvals.amazon.com/Approvals/pending
   - https://sim.amazon.com/issues/search?q=status%3A(Open)+containingFolder%3A(882ea546-8182-4a6b-a49e-ee50811f65cf)
   - Salesforce reports (3 tabs)
2. The userscript auto-captures the counts
3. Open your dashboard to see today's numbers

## Manual Entry

If the userscript doesn't capture correctly, you can always enter data manually:
1. Open the dashboard
2. Click "Show Form"
3. Enter the numbers and click "Save Entry"

## Export

Click "Export CSV" to download all historical data as a spreadsheet.
