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
| Jobs | Pipeline with Singapore-oriented sources and stages (Online Assessment, HireVue, Assessment Centre), role start and end dates, timeline of stages and interviewers, contacts, notes, tasks |
| Experience Bank | Entries and bullets with tags, archive, usage warnings, Claude's suggested additions for you to accept or reject, contact details for the resume header, JSON import and export |
| Resumes | Base and variant editor with a live A4 preview and a one-page check, reorder sections, items and bullets, see where Claude reworded a bullet and revert to the bank original |
| Cover letters | Editor with preview, same approval gate |
| Documents | Upload transcripts, certificates and testimonials into a readable folder layout; link them to applications |
| Availability | Confirmed and tentative blocks (exchange, trips, exams) on a timeline against the role periods of open applications, with clash warnings |
| Dashboard | Open applications, interviews and closing dates in the next two weeks, drafts awaiting approval, suggestions, clashes |
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

No server needed: on GitHub, open the repository on this branch, then **Code → Codespaces → Create codespace**. The first start installs everything and creates the database (a few minutes); the app then opens in a new tab. Create your account, and import your bank file on the Experience Bank page.

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

Tools Claude has: add, find, update and search jobs; read the bank, base versions and resumes; save a variant or base draft; suggest bank additions; save a cover letter draft; list documents. Prompts: `tailor_resume`, `add_to_bank`.

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

## Deployment

Not finalised yet. The Dockerfile and `docker-compose.yml` come from upstream and still need adjusting for this fork (mounting `/data`, `TZ=Asia/Singapore`, `NEXTAUTH_URL` set to the address your devices use).

## Licence

MIT, as upstream. See [LICENSE](./LICENSE).
