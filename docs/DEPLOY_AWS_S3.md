# Host the demo on AWS as a static website (Amazon S3 only)

This guide publishes Fractional AI Architecture as a **static website on Amazon S3**: no servers, no CloudFront, no backend.
Expect about 30 minutes the first time and 2 minutes for each update. Running cost is normally a few cents a month.

## How the static edition works

The full product needs the Python API. For a public website we build a **static demo** instead:

| | Full app (`make demo`) | Static website (`make static`) |
|---|---|---|
| Hosting | FastAPI server + UI | Files in an S3 bucket |
| Data | Live SQLite per tenant | JSON snapshot of both demo tenants (~12 MB), generated at build time |
| Pages | All | All (Overview, Savings, AI Governance, Design Reviews, Copilot, Approvals, Audit Trail, Sources, Settings, /welcome) |
| Agent **Re-run**, business case, risk classification, briefing, evidence pack | Live | Replays results recorded at build time |
| Copilot | Any question, any follow-up | The 12 suggested questions per tenant, each with 3 follow-ups ("Who owns them?", "How much do they cost?", "And which of those are high risk?") |
| Approve / reject / change automation level | Yes | No. Shows "This is a read-only demo. Book a live demo…" |
| Audit filters and CSV/JSON export | Yes | Yes (filters run in the browser, export downloads the snapshot) |

A yellow banner on every app page tells visitors that this is a read-only preview.

**Limitations of S3-only hosting (no CloudFront):**
- **HTTP only.** S3 website endpoints do not support HTTPS. Browsers show "Not secure", and the site cannot be served from an
  apex domain over HTTPS. To get HTTPS you need a CDN in front, such as CloudFront, Cloudflare or AWS Amplify Hosting (which uses CloudFront internally).
- **Deep links return HTTP 404 with the app page.** S3 serves `index.html` as the error document, so `/portfolio` loads correctly in
  every browser, but the status code is 404. Search engines may skip those URLs. The root URL and `/index.html` return 200.
- **The bucket is public.** That is fine here because the site contains only synthetic demo data. Never put real customer data in it.

---

## Step 0: Prerequisites

1. An AWS account with permission to create S3 buckets and change bucket policies.
2. AWS CLI v2: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
3. Credentials configured:
   ```bash
   aws configure            # Access key, secret, default region (e.g. us-east-1), output json
   aws sts get-caller-identity   # confirms who you are
   ```
   For a team, prefer IAM Identity Center (`aws configure sso`) over long-lived access keys.
4. Python 3.12+ and Node 18+, plus the repository:
   ```bash
   git clone https://github.com/CloudKatasani/Fractional-AI-Architecture.git
   cd Fractional-AI-Architecture
   make setup
   ```

## Step 1: Build the static site

```bash
make static
```

This does two things:
1. `npm run build:static` builds the UI with `VITE_STATIC_DEMO=1` into `frontend/dist/`.
2. `scripts/export_static.py` generates both demo tenants from the seed, records the actions and Copilot answers, and writes the
   snapshot to `frontend/dist/demo-data/` (about 3,000 small JSON files, ~12 MB). It takes 2–3 minutes.

Optional settings for the snapshot (set them before `make static`):
- `DEMO_TODAY=2026-10-01`: the "today" that all synthetic dates are relative to (default: the build date).
- `PLAN_NAME=Growth PLAN_FEE_USD=60000`: the plan the **Return on subscription** tile compares savings against.

**Test it locally before uploading:**
```bash
cd frontend/dist && python3 -m http.server 8080
```
Open http://localhost:8080/ (start at the root; this simple server has no fallback for deep links, unlike S3).

## Step 2: Create the bucket

Choose a globally unique bucket name. If you will use your own domain (Step 5), **the bucket name must equal the host name**,
for example `demo.example.com`.

```bash
export BUCKET=fractional-ai-demo-<something-unique>     # or demo.example.com
export AWS_REGION=us-east-1

# us-east-1 must NOT be given a LocationConstraint; every other region must.
if [ "$AWS_REGION" = "us-east-1" ]; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_REGION"
else
  aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_REGION" \
    --create-bucket-configuration LocationConstraint="$AWS_REGION"
fi
```

Console alternative: **S3 → Create bucket** → name and region → leave the rest as default for now → **Create bucket**.

## Step 3: Turn on static website hosting

```bash
aws s3 website "s3://$BUCKET" --index-document index.html --error-document index.html
```

Setting the **error document to `index.html`** is what makes the app's routes (`/portfolio`, `/copilot`, `/welcome` …) work
when someone opens or refreshes a deep link.

Console: bucket → **Properties** → **Static website hosting** → **Edit** → *Enable*, *Host a static website*,
Index document `index.html`, Error document `index.html` → **Save**.

## Step 4: Allow public read access

New buckets block all public access. Unblock it for this bucket only and add a read-only policy:

```bash
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false

cat > /tmp/policy.json <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadForWebsite",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::$BUCKET/*"
  }]
}
JSON
aws s3api put-bucket-policy --bucket "$BUCKET" --policy file:///tmp/policy.json
```

ACLs stay blocked; the bucket policy grants read access to objects (`s3:GetObject`) only, so nobody can list or write.

> If this fails with *AccessDenied … BlockPublicPolicy*, **account-level** Block Public Access is on
> (S3 console → *Block Public Access settings for this account*). An administrator must allow public policies,
> or you need a CDN (which this guide excludes).

Console: bucket → **Permissions** → **Block public access** → *Edit* → untick *Block public access to buckets and objects granted
through new public bucket policies* and *…any public bucket policies* → Save. Then **Bucket policy** → *Edit* → paste the JSON
above with your bucket name.

## Step 5: Upload the site

```bash
make deploy-s3 BUCKET=$BUCKET          # runs scripts/deploy_s3.sh $BUCKET
```

The script uploads `frontend/dist` with sensible caching:

| Path | Cache-Control | Why |
|---|---|---|
| `assets/*` (hashed JS/CSS) | 1 year, immutable | File names change on every build |
| `demo-data/*` | 5 minutes | Snapshot can be refreshed |
| `index.html` | no-cache | Visitors always get the newest bundle names |

`--delete` removes files from older builds. The script prints the website URL:

- `http://<bucket>.s3-website-<region>.amazonaws.com` (e.g. us-east-1, us-west-2, eu-west-1), or
- `http://<bucket>.s3-website.<region>.amazonaws.com` (e.g. eu-central-1, ap-south-1).

You can also find it under bucket → **Properties** → **Static website hosting** → *Bucket website endpoint*.

Without `make` (e.g. Windows):
```bash
aws s3 sync frontend/dist "s3://$BUCKET" --delete
```
(This works too; it just uses default caching.)

## Step 6: Check it

```bash
URL=http://$BUCKET.s3-website-$AWS_REGION.amazonaws.com   # adjust the format for your region (see above)
curl -sI "$URL/"                     | head -1   # HTTP/1.1 200 OK
curl -sI "$URL/welcome"              | head -1   # HTTP/1.1 404 (body is the app; expected, see Limitations)
curl -s  "$URL/demo-data/northgrid/_briefing.json" | head -c 120; echo
```

In a browser:
1. `/welcome`: the product page shows live proof numbers (savings identified, shadow IT, ROI multiple).
2. **Open live demo**, then **Overview**: the KPI tiles and charts load.
3. **SaaS & Cloud Savings** → **Re-run**: a toast shows the recorded findings.
4. **Copilot**: click *Which AI assets are unregistered?*, then type *Who owns them?*.
5. **Approvals** → **Approve**: you see the read-only message.
6. Switch the tenant to **Meridian Telecom**: all pages load.

## Step 7 (optional): Use your own domain, still HTTP only

1. The bucket name must equal the host, e.g. `demo.example.com` (create a new bucket and repeat Steps 2–5 if needed).
2. **Route 53**: in the hosted zone for `example.com`, **Create record** → name `demo` → type **A** → turn on **Alias** →
   *Alias to S3 website endpoint* → your region → select the bucket → **Create**.
   **Other DNS providers**: create a **CNAME** `demo` → `demo.example.com.s3-website-<region>.amazonaws.com`.
3. Open `http://demo.example.com`.

An apex domain (`example.com`) only works through a Route 53 alias and is HTTP only. Use a subdomain such as `demo.` and link to
it from your marketing site.

## Updating the site

```bash
git pull
make static
make deploy-s3 BUCKET=$BUCKET
```

To show "today" consistently in sales demos, pin the date: `DEMO_TODAY=2026-10-01 make static`.

## Automating deployment with GitHub Actions (optional)

1. In AWS, create an IAM OIDC identity provider for `token.actions.githubusercontent.com` and a role that trusts your repository,
   with this policy:
   ```json
   {"Version": "2012-10-17", "Statement": [
     {"Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::BUCKET"},
     {"Effect": "Allow", "Action": ["s3:PutObject", "s3:DeleteObject", "s3:GetObject"], "Resource": "arn:aws:s3:::BUCKET/*"}]}
   ```
2. Add `.github/workflows/deploy-s3.yml`:
   ```yaml
   name: Deploy static demo to S3
   on: { push: { branches: [main] }, workflow_dispatch: {} }
   permissions: { id-token: write, contents: read }
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-python@v5
           with: { python-version: "3.12" }
         - uses: actions/setup-node@v4
           with: { node-version: "20" }
         - run: make setup
         - run: make static
         - uses: aws-actions/configure-aws-credentials@v4
           with:
             role-to-assume: arn:aws:iam::<ACCOUNT_ID>:role/<DEPLOY_ROLE>
             aws-region: us-east-1
         - run: make deploy-s3 BUCKET=<your-bucket>
   ```

## Cost

S3 Standard storage for ~15 MB is a fraction of a cent a month. Each page view makes about 10–40 small GET requests
(~$0.0004 per 1,000 requests) plus data transfer out (the first 100 GB/month are free across your AWS account). A demo site
with a few thousand visits a month typically costs **under $1/month**. Set an **AWS Budget** alert (for example $5) to be safe.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `403 Forbidden` on every page | The bucket policy is missing, or Block Public Access is still on (Step 4). |
| `404 NoSuchWebsiteConfiguration` | Website hosting is not enabled (Step 3). |
| URL `…s3.amazonaws.com/…` downloads files or shows XML | You are using the REST endpoint. Use the **website** endpoint (`s3-website`). |
| Deep link shows the S3 404 page | Error document is not `index.html` (Step 3). |
| Pages show errors such as `Unexpected token '<'` | You uploaded `make build` output (it expects the API). Run `make static` and deploy again. |
| Pages say "Not included in the static demo" | `demo-data/` was not uploaded, or is from an older build. Run `make static` and deploy again. |
| App looks stale after a deploy | Your browser cached the old `index.html` from a manual upload. Use `make deploy-s3`, which sets `no-cache`, then hard refresh. |
| Need HTTPS, a 200 status on deep links, or a custom apex domain | Not possible with S3 alone. Add a CDN (CloudFront, Cloudflare or Amplify Hosting). |

## Tear down

```bash
aws s3 rm "s3://$BUCKET" --recursive
aws s3api delete-bucket --bucket "$BUCKET" --region "$AWS_REGION"
```
Also remove the Route 53 record if you created one.

## Hosting the full interactive product

The static site is a sales demo. The real product, with live agents, approvals that persist and any Copilot question, needs the
FastAPI backend running (for example on AWS App Runner or ECS Fargate) and is outside the scope of this guide.
