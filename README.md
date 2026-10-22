# JobSync (personal fork)

A self-hosted application tracker and resume crafter. It tracks job applications, keeps documents on your own server's filesystem, and builds company- or role-specific resumes from a single bank of your experience. Claude does the tailoring through your own Claude subscription over MCP, so no API key is needed. Nothing becomes a file until you approve it.

Forked from [Gsync/jobsync](https://github.com/Gsync/jobsync) (MIT). The automations, in-app AI chat, AI provider settings, activity timer, daily goals and question bank were removed; the experience bank, resume and letter pipeline, document vault and availability planner were added.

## How it works

```
Experience Bank ──► Base versions (PM, SWE, Cloud, …) ──► Job variant ──► Approve ──► PDF ──► Mark as sent
   (facts)              (your curated starting points)     (Claude or you)   (you)              (frozen copy in the
                                                                                                application folder)
```

- **Experience Bank** holds every education entry, role, project, leadership position, award, certification and skills line, each with reusable bullets and tags. It is the single source of truth.
- **Base versions** are your curated resumes for a kind of role. Each line points back to a bank bullet.
- **Variants** are tailored to one job. Claude reads the job description, your bank and the right base, then saves a draft variant. It may reword a bullet to land harder, but every line must cite the bank bullet it came from; the server rejects anything that does not.
- **Approval is yours alone.** The MCP server has no tool to approve, export or send. Drafts have no PDF. Editing an approved resume sends it back to draft.
- **Mark as sent** writes the PDF into that job's folder on disk, saves the job description beside it, and freezes the resume as the record of what went out.

Cover letters follow the same draft → approved → sent lifecycle.

## Features

| Area | What it does |
|---|---|
| Jobs | Pipeline with Singapore-oriented sources and stages (Online Assessment, HireVue, Assessment Centre), role start and end dates, timeline of stages and interviewers, contacts, notes, tasks. An application seasons bar across the top shows when your targets take applications |
| Seasons | Target companies and role types with their application windows per intake: open, closing soon, opens soon, closed. Claude researches windows with sources; they stay suggestions until you confirm them. Role periods that clash with your availability show in red, and matching jobs are linked automatically. Once a season closes, **Estimate next year** copies its windows forward a year (anchored on when your matching jobs actually appeared), marked as estimates for Claude to verify |
| Interview prep | Each round on a job's timeline has your own notes plus two Claude sections: prep before the round, and a debrief after it that checks the prep against what actually happened. Earlier debriefs at the same company feed the next prep |
| Experience Bank | Entries and bullets with tags, archive, usage warnings, Claude's suggested additions for you to accept or reject, contact details for the resume header, JSON import and export |
| Resumes | Base and variant editor with a live A4 preview and a one-page check, reorder sections, items and bullets, see where Claude reworded a bullet and revert to the bank original. New lines come only from the bank: **Add from bank** and **Add bullet from bank** list what the resume does not use yet, so to add something new, put it in the bank first |
| Base gaps | On each base version: what that kind of role asks for across the job descriptions Claude has read, how well your bank covers each requirement, how applications sent with it fared and where they stopped, bullets with no measurable result, and Claude's written review. Small numbers are labelled as a rough guide |
| Cover letters | Editor with preview, same approval gate |
| Documents | Upload transcripts, certificates and testimonials into a readable folder layout; link them to applications |
| Availability | Confirmed and tentative blocks (exchange, trips, exams) on a timeline against the role periods of open applications, with clash warnings |
| Dashboard | Open applications, interviews, closing dates and application windows in the next two weeks, drafts awaiting approval, suggestions to check, clashes |
| Data | One-click backup zip of the database and every file; bank export |

## Files on disk

Everything lives under `DATA_DIR` (`./data` in development, `/data` in Docker), in folders you can browse without the app:

```
data/
├── vault/
│   ├── transcript/Transcript_SMU_AY2025.pdf
│   └── certificate/…
└── applications/
    └── 2026/
        └── Shopee - Product Manager Intern/
            ├── job-description.md
            ├── Your Name - Resume.pdf
            └── Your Name - Cover Letter.pdf
```

Sent files are named for the recruiter (your name, then Resume or Cover Letter), and the PDF title matches. Files are never overwritten: a name clash gets " (2)" appended. Deleting a sent resume's record keeps its PDF.

## Trying it in a Codespace

No server needed: on GitHub, open the repository, then **Code → Codespaces → Create codespace**. The first start installs everything and creates the database (a few minutes); the app then opens in a new tab. Create your account, and import your bank file on the Experience Bank page.

The Codespace's database and files live only in that Codespace. Download a backup from **Settings → Data & Backup** before deleting it.

## Running it locally

Requires Node 20+.

```bash
npm install
cp .env.example .env
npx prisma migrate deploy
npm run dev            # http://localhost:3737
```

The first account you create becomes the only one; sign-up closes after that.

## Connecting Claude

1. In JobSync, go to **Settings → MCP Access**, generate a token named after the client, and copy the config it shows.
2. **Claude Desktop:** Settings → Developer → Edit Config, merge the `jobsync` entry into `claude_desktop_config.json`, restart. This uses [`mcp-remote`](https://www.npmjs.com/package/mcp-remote), so Node must be installed on that computer.
   **Claude Code:** run the `claude mcp add …` command shown.
3. Open a job in JobSync and press **Copy Claude Prompt**, then paste it into Claude. Claude picks a base, tailors it to the job description, saves a draft variant with notes on what it changed, and gives you the review link.

Tools Claude has:
- **Jobs:** add jobs (one at a time or in a batch), find, update and search them; read a job's rounds and add a round you report; save prep notes and debriefs.
- **Seasons:** list targets; save researched application windows (as suggestions).
- **Resumes:** read the bank, base versions and resumes; save a variant or base draft; suggest bank additions; save a cover letter draft; list documents.
- **Gaps:** record a job's requirements and how the bank covers them (done while tailoring); read a base's gap data; save a gap review.

Claude cannot approve, export or send anything, confirm a window, or edit your own stage notes.

Prompts: `tailor_resume`, `add_to_bank`, `research_windows`, `prep_interview`, `debrief_interview`, `review_base_gaps`. The app also has copy-prompt buttons in the matching places: **Research with Claude** on Seasons, **Prep with Claude** and **Debrief with Claude** on each round, and **Ask Claude for a review** on a base's Gaps tab.

## Seeding your bank

On the Experience Bank page, **Import** accepts a bank JSON file (`version: 1`): contact header, entries with keyed bullets, and base versions that reference those keys. Import appends; it never overwrites. **Export** produces the same format, so a bank moves between installs. Keep your filled-in bank file out of this repository: it contains your contact details.

## Tests

```bash
npm test               # unit and integration (real SQLite in a temp dir)
npm run lint
npx tsc --noEmit
npm run test:e2e       # Playwright
```

Integration specs (`__tests__/*.integration.spec.ts`) cover the rules that matter most: bullet provenance, the approval gate, frozen snapshots, file paths that cannot escape `DATA_DIR`, MCP scopes, and bank import validation.

## Deployment (Ubuntu server on Tailscale)

JobSync runs as one Docker container bound to `127.0.0.1` only. `tailscale serve` puts it on your tailnet over HTTPS on its own port, so it sits beside your other services without touching them, and nothing is exposed to the internet.

```
your laptop / phone ──tailnet, HTTPS──► tailscale serve :8443 ──► 127.0.0.1:3737 ──► container ──► ./jobsync-data
```

### What you need

- Docker Engine with the Compose plugin ([install guide](https://docs.docker.com/engine/install/ubuntu/)). Check with `docker compose version`.
- Tailscale on the server, already in your tailnet.
- **HTTPS certificates enabled for your tailnet:** Tailscale admin console → **DNS** → turn on **MagicDNS** and **HTTPS Certificates**. If your other services already use `https://…ts.net`, this is done.

### 1. Get the code

```bash
git clone https://github.com/chuadongen/jobsync.git ~/jobsync
cd ~/jobsync
```

### 2. Pick a port and an address

```bash
sudo tailscale serve status          # HTTPS ports your other services already use
ss -ltn | grep -E ':3737\b'          # anything already on 3737?
tailscale status --json | grep -m1 '"DNSName"'   # e.g. "myserver.tail1234.ts.net."
```

Choose an HTTPS port nothing else uses on the tailnet side (this guide uses **8443**) and a local port that is free (default **3737**).

### 3. Configure

```bash
cp .env.example .env
nano .env
```

Set:

| Variable | Value |
|---|---|
| `NEXTAUTH_URL` | `https://myserver.tail1234.ts.net:8443` (your DNS name without the trailing dot, and your port) |
| `JOBSYNC_PORT` | `3737`, or the free local port you picked |
| `JOBSYNC_DATA` | `./jobsync-data` is fine; any absolute path works |
| `BACKUP_TOKEN` | output of `openssl rand -hex 32` |
| `TZ` | `Asia/Singapore` |

Leave `AUTH_SECRET` empty: one is generated on first start and kept in the data folder, so restarts do not log you out. The lines under "Local development only" are ignored on the server.

### 4. Build and start

```bash
./deploy.sh
```

The first build takes a few minutes. The script waits until the app answers on `127.0.0.1`.

### 5. Put it on the tailnet

```bash
sudo tailscale serve --bg --https=8443 http://127.0.0.1:3737
sudo tailscale serve status
```

This adds one entry and leaves your other `serve` entries as they are. Do not run `tailscale serve reset`, which clears all of them. JobSync must be served at the root of its own port, not under a path such as `/jobsync`.

### 6. Create your account straight away

Open `https://myserver.tail1234.ts.net:8443` from any device on your tailnet and create your account. The first account is the only one and sign-up closes after it, so do this before anyone else on your tailnet could.

Then import your bank file on the **Experience Bank** page, and connect Claude as described in [Connecting Claude](#connecting-claude). The computer running Claude Desktop needs Tailscale running. The config snippet in Settings already uses the HTTPS address.

### 7. Nightly backups

```bash
mkdir -p ~/jobsync-backups
crontab -e
```

Add (adjust the paths to your home directory):

```
30 3 * * * /home/YOU/jobsync/scripts/backup.sh /home/YOU/jobsync-backups >> /home/YOU/jobsync-backups/backup.log 2>&1
```

Each run saves `jobsync-YYYY-MM-DD-HHMMSS.zip` (database, documents and sent PDFs) and keeps the newest 30 (`KEEP=60 scripts/backup.sh …` to keep more). The script refuses anything that is not a real zip, so a failed run shows in `backup.log` instead of leaving a broken file. Run it once by hand to check, and copy the backup folder somewhere off the server from time to time, for example with `rsync` to another tailnet machine.

### Updating

```bash
cd ~/jobsync && ./deploy.sh
```

This pulls the checked-out branch (`main`), rebuilds and restarts. `./deploy.sh <branch>` switches to another branch first. Data in `jobsync-data` is untouched; database migrations run on start.

### Restoring a backup

```bash
cd ~/jobsync
docker compose down
unzip -o ~/jobsync-backups/jobsync-2026-10-21-033000.zip -d ./jobsync-data
docker compose up -d
```

`jobsync.db`, `vault/` and `applications/` land back in the data folder. You will need to sign in again if the restore is onto a fresh data folder.

### Troubleshooting

| Symptom | Fix |
|---|---|
| The page will not load over HTTPS | `sudo tailscale serve status` should list your port pointing at `127.0.0.1:3737`; `curl -I http://127.0.0.1:3737/signin` on the server should return 200. |
| Login loops back to the sign-in page, or buttons do nothing | `NEXTAUTH_URL` must match the address in the browser exactly, port included. It is built into the image, so after fixing `.env`, run `./deploy.sh` again. |
| Port already in use on start | Change `JOBSYNC_PORT` in `.env`, use the same port in the `tailscale serve` command, and run `./deploy.sh`. |
| Claude Desktop shows no jobsync tools | Tailscale must be running on that computer; the token must be current (Settings → MCP Access); restart Claude Desktop fully after editing its config. |
| Anything else | `docker compose logs --tail 100` |

## Licence

MIT, as upstream. See [LICENSE](./LICENSE).
