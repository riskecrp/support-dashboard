# Support Staff Management Dashboard

Welcome to the Support Staff Management Dashboard. This is a Next.js web application designed to act as a "remote control" for your staff management Google Sheets. It allows leadership teams to track quotas, record monthly statistics, and manage an active roster through a clean, automated web interface without needing to manually edit spreadsheet rows.



## Phase 1
Before you begin, ensure you have the following accounts set up:
* A **Google Account** (to host the spreadsheet and access the Google Cloud Console)
* A **GitHub Account** (to copy and store the code)
* A **Railway.app Account** (for free/low-cost web hosting)
* **Node.js** installed on your computer (if you plan to test the code locally)

---

## Phase 2: Generating Google API Credentials
The dashboard needs permission to read and write to your private Google Sheet.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a **New Project**.
3. Navigate to **APIs & Services > Library**, search for the **Google Sheets API**, and click **Enable**.
4. Go to **Credentials**, click **Create Credentials**, and select **Service Account**.
5. Once created, click on the Service Account, go to the **Keys** tab, click **Add Key > Create New Key**, and select **JSON**. Download this file to your computer.
6. Open the downloaded JSON file in any text editor. You will need two specific pieces of information for later: the `client_email` and the `private_key`.
7. **CRITICAL STEP:** Go to your Google Sheet, click the "Share" button, and invite the `client_email` (it will end in `.iam.gserviceaccount.com`) as an **Editor**. If you skip this, the dashboard will not be able to write data.

---

## Phase 3: Copying the Repository (Forking)
To use this code, you need your own personal copy attached to your GitHub account so that your hosting provider can access it.

1. At the top right of this repository page, click the **Fork** button.
2. Click **Create Fork**. This creates an exact replica of this code under your own GitHub profile.

**(Optional) Testing Locally:**
If you want to run the dashboard on your own computer before putting it on the internet:
1. Open your terminal and clone your new forked repository: `git clone https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git`
2. Navigate into the folder: `cd YOUR-REPO-NAME`
3. Install the required dependencies: `npm install`
4. Create a file named `.env.local` in the root folder and add your credentials (see the variables in Phase 4).
5. Run the local server: `npm run dev` and open `http://localhost:3000` in your browser.

---

## Phase 4: Railway Deployment (Going Live)
Railway is the cloud platform that will host the Next.js application so your team can access it from anywhere.

1. Log into [Railway.app](https://railway.app/) and click **New Project**.
2. Select **Deploy from GitHub repo** and choose the repository you just forked in Phase 3.
3. Railway will immediately try to build the site. **The first build will fail.** This is normal because it doesn't have your Google Sheets passwords yet.
4. Click on your newly created service box in Railway and go to the **Variables** tab.
5. Click **New Variable** and add the following three environment variables exactly:
   * **VARIABLE NAME:** `GOOGLE_SPREADSHEET_ID`
     * **VALUE:** The long string of letters and numbers located in your Google Sheet's URL.
   * **VARIABLE NAME:** `GOOGLE_SERVICE_ACCOUNT_EMAIL`
     * **VALUE:** The specific email address you grabbed from your JSON file in Phase 2.
   * **VARIABLE NAME:** `GOOGLE_PRIVATE_KEY`
     * **VALUE:** The massive block of text from the JSON file. **You must copy the entire thing, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` portions.**
6. Once you save those variables, Railway will automatically trigger a new build. Wait for the status to turn green.
7. Go to the **Settings** tab in Railway, scroll down to the **Networking** section, and click **Generate Domain**. 

Railway will provide you with a live `up.railway.app` link. Share this link with your management team—your dashboard is now fully functional and live!
