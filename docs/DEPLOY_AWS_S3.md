# Host the demo on AWS as a static website (Amazon S3 only, using the AWS Console)

This guide publishes Fractional AI Architecture as a **static website on Amazon S3**, entirely from the browser:
GitHub to build the site, and the **AWS Management Console** to host it. No servers, no CloudFront, no command line.
Expect about 30 minutes the first time and 5 minutes for each update. Running cost is normally under $1 a month.

## How the static edition works

The full product needs the Python API. For a public website we build a **static demo** instead:

| | Full app (`make demo`) | Static website |
|---|---|---|
| Hosting | FastAPI server + UI | Files in an S3 bucket |
| Data | Live SQLite per tenant | JSON snapshot of both demo tenants (~12 MB), generated at build time |
| Pages | All | All (Overview, Savings, AI Governance, Design Reviews, Copilot, Approvals, Audit Trail, Sources, Settings, /welcome) |
| Agent **Re-run**, business case, risk classification, briefing, evidence pack | Live | Replays results recorded at build time |
| Copilot | Any question, any follow-up | The 12 suggested questions per tenant, each with 3 follow-ups ("Who owns them?", "How much do they cost?", "And which of those are high risk?") |
| Approve / reject / change automation level | Yes | No. Shows "This is a read-only demo. Book a live demo…" |
| Audit filters and CSV/JSON export | Yes | Yes |

A yellow banner on every app page tells visitors that this is a read-only preview.

**Limitations of S3-only hosting (no CloudFront):**
- **HTTP only.** S3 website endpoints do not support HTTPS, so browsers show "Not secure". HTTPS needs a CDN in front, such as
  CloudFront, Cloudflare or AWS Amplify Hosting (which uses CloudFront internally).
- **Deep links return HTTP status 404 with the app page.** `/portfolio` still opens correctly in every browser, because S3 serves
  `index.html` as the error page, but search engines may skip those URLs. The root URL returns 200.
- **The bucket is public.** That is fine here because the site contains only synthetic demo data. Never put real customer data in it.

---

## Step 1: Build the website files (GitHub, in the browser)

The repository has a workflow, `.github/workflows/static-site.yml`, that builds the site and packages it for download.
It runs automatically on every push to `main`. You can also run it by hand:

1. Open https://github.com/CloudKatasani/Fractional-AI-Architecture → **Actions** tab.
   If GitHub asks, click **I understand my workflows, go ahead and enable them**.
2. In the left list, click **Build static website** → **Run workflow** (right side) → branch `main`.
   Optionally enter a **Demo date** (for example `2026-10-01`) so the demo's dates stay fixed → **Run workflow**.
3. Wait for the green tick (about 4–5 minutes). Click the run.
4. Under **Artifacts** at the bottom of the run page, click **static-site** to download `static-site.zip`.
5. **Unzip it** on your computer. You get a folder containing:
   ```
   index.html
   assets/        (JavaScript and CSS)
   demo-data/     (northgrid/ and meridian/ JSON snapshots)
   ```
   Keep this folder open; you will drag its **contents** into S3 in Step 5.

> Prefer to build locally? Run `make setup && make static`; the same files appear in `frontend/dist/`.

## Step 2: Create the S3 bucket

1. Sign in to the AWS Console → search **S3** → open **S3**.
2. Pick the **Region** in the top-right corner (for example *US East (N. Virginia) us-east-1*, or one near your customers).
3. Click **Create bucket**.
4. **General configuration**
   - *Bucket type*: **General purpose** (if shown).
   - *Bucket name*: a globally unique name, lowercase, e.g. `fractional-ai-demo-acme`.
     If you will use your own domain later (Step 8), **the bucket name must equal the host name**, e.g. `demo.example.com`.
5. **Object Ownership**: leave **ACLs disabled (recommended)**.
6. **Block Public Access settings for this bucket**: **untick** *Block all public access*.
   Tick the acknowledgement *I acknowledge that the current settings might result in this bucket and the objects within becoming public*.
7. Leave **Bucket Versioning** disabled, **Default encryption** as SSE-S3, and the rest as default.
8. Click **Create bucket**.

> If unticking is not allowed, **account-level** Block Public Access is on: S3 left menu → **Block Public Access settings for
> this account** → **Edit**. An administrator must allow public bucket policies, or you need a CDN (which this guide excludes).

## Step 3: Turn on static website hosting

1. Open your bucket → **Properties** tab → scroll to the bottom → **Static website hosting** → **Edit**.
2. *Static website hosting*: **Enable**.
3. *Hosting type*: **Host a static website**.
4. *Index document*: `index.html`
5. *Error document*: `index.html`. This is what makes app links like `/portfolio` and `/copilot` work when opened directly or refreshed.
6. Click **Save changes**.
7. Back on the **Properties** tab, at the bottom, copy the **Bucket website endpoint**, for example
   `http://fractional-ai-demo-acme.s3-website-us-east-1.amazonaws.com`. This is your site's URL.

## Step 4: Allow public read access (bucket policy)

1. Bucket → **Permissions** tab → **Bucket policy** → **Edit**.
2. Paste this, replacing `YOUR-BUCKET-NAME` with your bucket name (the *Bucket ARN* shown above the editor helps):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadForWebsite",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
       }
     ]
   }
   ```
3. Click **Save changes**. The bucket now shows a red **Publicly accessible** label, which is expected.

The policy only allows reading files (`s3:GetObject`). Visitors cannot list, upload or delete anything.

## Step 5: Upload the website files

1. Bucket → **Objects** tab → **Upload**.
2. Open the unzipped folder from Step 1 and select **everything inside it**: `index.html` and the `assets` and `demo-data` folders. Drag them into the upload page.
   - Drag the **contents**, not the folder itself. `index.html` must end up at the top level of the bucket, not inside
     `static-site/`.
   - Use drag-and-drop; **Add files** cannot add folders and **Add folder** adds one folder at a time.
3. The list should show about 3,000 files, ~16 MB in total. Leave **Destination** as the bucket root.
4. Optional: expand **Properties** → **Metadata** → **Add metadata** → *Type* System defined, *Key* `Cache-Control`,
   *Value* `max-age=300`. This makes browsers re-check files after 5 minutes, which helps when you update the site.
5. Click **Upload** and wait until the status bar says **Upload succeeded** (a minute or two). Click **Close**.

The Console sets each file's content type from its extension (`.html`, `.js`, `.css`, `.json`), so you don't need to change anything.

## Step 6: Open and check the site

Open the **Bucket website endpoint** from Step 3. Use the `s3-website` address, not the *Object URL*.

1. `…/welcome`: the product page shows live proof numbers (savings identified, shadow IT, ROI multiple).
2. **Open live demo**, then **Overview**: the KPI tiles and charts load.
3. **SaaS & Cloud Savings** → **Re-run**: a message shows the recorded findings.
4. **Copilot**: click *Which AI assets are unregistered?*, then type *Who owns them?*.
5. **Approvals** → **Approve**: you see the read-only message.
6. Switch the tenant at the top to **Meridian Telecom**: all pages load.
7. Refresh the browser on `/portfolio`: the page still loads (the error document is working).

## Step 7: Updating the site

1. Push changes to `main` (or run **Build static website** by hand) and download the new **static-site** artifact (Step 1).
2. In the bucket, select all objects (tick the header checkbox) → **Delete** → type `permanently delete` → **Delete objects**.
   Deleting first removes old JavaScript bundles from the previous build.
3. Upload the new contents as in Step 5.
4. If you skipped the `Cache-Control` metadata, visitors may need a hard refresh (Ctrl+F5 or Cmd+Shift+R) to see the new version.

## Step 8 (optional): Use your own domain, still HTTP only

1. The bucket name must equal the host name, for example `demo.example.com`. If it doesn't, create a new bucket with that name
   and repeat Steps 2–5.
2. **If your domain is in Route 53**: Console → **Route 53** → **Hosted zones** → `example.com` → **Create record**:
   - *Record name*: `demo`
   - *Record type*: **A**
   - Turn on **Alias**
   - *Route traffic to*: **Alias to S3 website endpoint** → choose your bucket's Region → choose the endpoint (`s3-website-…`)
   - **Create records**
3. **If your domain is with another DNS provider**: add a **CNAME** record `demo` →
   `demo.example.com.s3-website-<region>.amazonaws.com` (copy the host part of your bucket website endpoint).
4. After a few minutes, open `http://demo.example.com`.

Use a subdomain such as `demo.` and link to it from your marketing site. An apex domain (`example.com`) works only through a Route 53
alias, and only over HTTP.

## Step 9 (recommended): Add a budget alert

Console → **Billing and Cost Management** → **Budgets** → **Create budget** → **Use a template** → **Monthly cost budget** →
amount `5` USD → your email → **Create budget**. A demo site with a few thousand visits a month normally costs well under $1.
S3 charges for storage (~16 MB, fractions of a cent), GET requests (~$0.0004 per 1,000) and data transfer beyond the free tier.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `403 Forbidden` on every page | The bucket policy is missing or has the wrong bucket name (Step 4), or Block Public Access is still on (Step 2). |
| `404 Not Found … NoSuchWebsiteConfiguration` | Static website hosting is not enabled (Step 3). |
| Page shows XML or downloads files | You opened the *Object URL* (`s3.amazonaws.com`). Use the **Bucket website endpoint** (`s3-website`). |
| `404 … NoSuchKey` for `index.html` | Files were uploaded inside a folder such as `static-site/`. Delete them and upload the folder's **contents** (Step 5). |
| Refreshing `/portfolio` shows an S3 error page | The *Error document* is not `index.html` (Step 3). |
| Pages show errors such as `Unexpected token '<'` | The files come from `make build`, which expects the API. Use the **static-site** artifact or `make static`. |
| Pages say "Not included in the static demo" | The `demo-data` folder was not uploaded, or is from an older build. Upload it again. |
| The **static-site** artifact is missing | Artifacts expire after 30 days. Run the workflow again (Step 1). |
| Need HTTPS, a 200 status on deep links, or an apex domain over HTTPS | Not possible with S3 alone. Add a CDN (CloudFront, Cloudflare or Amplify Hosting). |

## Removing the site

1. S3 → your bucket → select all objects → **Delete** → `permanently delete`.
2. Back in the bucket list, select the bucket → **Delete** → type the bucket name → **Delete bucket**.
3. Delete the Route 53 record if you created one.

---

## Appendix: the same steps from the command line

For people who prefer the AWS CLI (`aws configure` first):

```bash
make setup && make static                        # build into frontend/dist
export BUCKET=fractional-ai-demo-acme AWS_REGION=us-east-1
aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_REGION"   # outside us-east-1 add:
#   --create-bucket-configuration LocationConstraint="$AWS_REGION"
aws s3 website "s3://$BUCKET" --index-document index.html --error-document index.html
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\
\"Principal\":\"*\",\"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::$BUCKET/*\"}]}"
make deploy-s3 BUCKET=$BUCKET                     # upload with cache headers; prints the URL
```

`make deploy-s3` (`scripts/deploy_s3.sh`) caches `assets/` for a year, `demo-data/` for 5 minutes and `index.html` not at all,
and removes files left over from older builds.

## Hosting the full interactive product

The static site is a sales demo. The real product, with live agents, approvals that persist and any Copilot question, needs the
FastAPI backend running (for example on AWS App Runner or ECS Fargate) and is outside the scope of this guide.
