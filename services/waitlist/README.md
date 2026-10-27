# Floorplan Cloud waitlist service

A tiny service on Google Cloud Run that adds opt-in sign-ups from the map's corner card to a private Google Sheet. What users are told about it is in [Privacy and security](../../docs/privacy-and-security.md#floorplan-cloud-waitlist).

Its address ships in the plugin's public code, so it's built to be harmless when found.

| Protection | How |
|---|---|
| Write-only | Never returns anything from the sheet. A repeat sign-up gets the same reply as a new one, so nobody can check whether an address is listed. |
| Strict input | `POST /` only, a 1 KB body, `{ "email", "use": "solo" \| "team" }`. Values are written as plain text (`valueInputOption=RAW`), and emails must start with a letter or digit, so nothing becomes a formula. |
| Per-IP limit | `PER_IP_HOUR` requests per address per hour, valid or not (default 5). IPv6 is limited by /64. The address comes from the last `X-Forwarded-For` entry, the one Google's front end adds, so a client can't fake it. |
| Overall limits | `GLOBAL_MINUTE` (30) and `GLOBAL_DAY` (2000) sign-ups, and `MAX_ROWS` (20000) in total. |
| Cost cap | Deployed with `--max-instances 1`. That also keeps the limits exact, since they're kept in memory. |
| Least privilege | Runs as its own service account with no project roles. Its only access is editor on the one sheet. |
| No IPs stored | Addresses are held in memory for rate limiting and never written to the sheet. |

There are no dependencies: it needs Node 20+.

## Run it locally

```bash
DRY_RUN=1 PORT=8099 node services/waitlist/server.mjs
```

`DRY_RUN=1` logs sign-ups instead of writing them. To point a map's server at it:

```bash
FLOORPLAN_WAITLIST_URL=http://127.0.0.1:8099/ node floorplan/serve.mjs
```

## Deploy

Every command uses the `floorplan` gcloud configuration, so it never touches your other projects.

1. **Create a Google Sheet** and copy its ID from its URL (`/d/<ID>/edit`). The service adds the headings itself. Note the tab's name (`Sheet1` unless you rename it).
2. **Create a project and link billing.** Cloud Run needs billing, but this stays inside the free tier.
   ```bash
   gcloud projects create <PROJECT> --configuration floorplan
   gcloud billing projects link <PROJECT> --billing-account <BILLING_ACCOUNT> --configuration floorplan
   gcloud config set project <PROJECT> --configuration floorplan
   ```
3. **Turn on the APIs it needs:**
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sheets.googleapis.com --configuration floorplan
   ```
4. **Create two service accounts.**
   - The service runs as one with no roles. Share the sheet with `waitlist@<PROJECT>.iam.gserviceaccount.com` as an **Editor**.
   - The other builds the container, with only the Cloud Run builder role, so the project's default account isn't widened.
   ```bash
   gcloud iam service-accounts create waitlist --display-name "Floorplan waitlist" --configuration floorplan
   gcloud iam service-accounts create waitlist-build --display-name "Floorplan waitlist builds" --configuration floorplan
   gcloud projects add-iam-policy-binding <PROJECT> --member serviceAccount:waitlist-build@<PROJECT>.iam.gserviceaccount.com --role roles/run.builder --condition=None --configuration floorplan
   ```
5. **Deploy:**
   ```bash
   gcloud run deploy waitlist --source services/waitlist --region us-central1 --allow-unauthenticated \
     --build-service-account projects/<PROJECT>/serviceAccounts/waitlist-build@<PROJECT>.iam.gserviceaccount.com \
     --service-account waitlist@<PROJECT>.iam.gserviceaccount.com \
     --max-instances 1 --concurrency 40 --cpu 1 --memory 256Mi --timeout 10 \
     --set-env-vars SHEET_ID=<SHEET_ID>,SHEET_TAB=<TAB> --configuration floorplan
   ```
   If making it public fails with "do not belong to a permitted customer", your Google Workspace organization's "Domain restricted sharing" policy is blocking public access. Turn off the invoker check for just this service:
   ```bash
   gcloud run services update waitlist --no-invoker-iam-check --region us-central1 --configuration floorplan
   ```
6. **Set a budget alert**, for example $5, under Billing → Budgets & alerts.
7. **Point the plugin at it:** put the service URL in `WAITLIST_URL` in [`serve.mjs`](../../skills/floorplan/assets/serve.mjs).
