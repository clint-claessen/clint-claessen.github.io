# TaDa Executive Committee — setup and how it fits together

The committee area is a static page in this repository plus a free Firebase project
(`tadawebsite`) that provides the logins and the shared database. Nothing is billed on the
free "Spark" plan at this size (four users, a few hundred documents).

Console: https://console.firebase.google.com/project/tadawebsite

## Pages
| URL | What it is |
| --- | --- |
| `/tadawebsite/` | Public site: next session, programme, join band, archive, organizers. Reads `data/talks.json` and, when published, the live programme from Firestore. |
| `/tadawebsite/speak/` | Speaker form linked from invitation e-mails: title, abstract, links, portrait, available dates (the open slots), notes. Writes to Firestore `responses` (the recording question was removed in Sep 2026; the field is sent empty so the published rules still apply). |
| `/tadawebsite/committee/` | Organizer app: Series, Speaker responses, Candidates, Messages, Profile & settings. |

## 1. Web app config → `committee/config.js` — DONE (10 Sep 2026)
The `firebaseConfig` object from Project settings → General → Your apps is in `config.js`.
It is public by design; access is controlled by the rules in step 3.

## 2. Logins (Authentication) — steps 1–3 DONE, step 4 is yours
1. Sign-in method → Email/Password enabled (first toggle only).
2. Settings → User actions → "Enable create (sign-up)" is unticked: nobody can register themselves.
3. Settings → Authorized domains: `clintclaessen.com`, `clint-claessen.github.io` (add `tada.cool` when the site moves there).
4. **Users** tab → **Add user** once per organizer: institutional e-mail + a temporary password.
   Send each person their temporary password privately (WhatsApp). Everyone changes it under
   *Profile & settings* after the first login, and can change their e-mail there too.

## 3. Database (Cloud Firestore) — created in europe-west3; rules must be re-published after each change
Rules tab → replace everything with the contents of `committee/firestore.rules` → **Publish**.
The current rules add the `responses` collection (public create, validated field lengths) and
allow reactions on other people's messages.

## Public bios (team cards)
Each organizer edits their own card under *Profile & settings → Public bio* (field line, position ·
institution, one sentence, website, portrait). *Save and publish* writes `public/team`, which the public
page reads on load; empty fields keep the fixed text that is in `index.html`. *Publish to website* in the
Series view refreshes the same document. Portraits: put a square JPEG in `assets/team/` (repo) or use a link.

## 4. First login
1. Open `https://clintclaessen.com/tadawebsite/committee/` and sign in.
2. *Profile & settings*: display name, username (for @mentions), initials (used as chair/owner),
   and the sentence you use to introduce yourself in invitations.
3. *Profile & settings* → **Access allow-list**: the four organizer e-mails, one per line.
   From then on only those addresses can create a profile, even if sign-up were re-enabled.
4. *Series* → **Import Fall 2026 starter data** (shown while the database is empty) loads the
   five slots and the six candidates. **Theme** sets the term theme used in drafts.
5. *Series* → **Publish to website** pushes the term to the public page. Speakers appear there
   only when their status is *confirmed* or *done*; other dates show as open slots.

## Daily use
- **Candidates**: keep ideas, generate the invitation draft (uses your intro, the open dates and
  the speaker-form link), *Open in e-mail* puts the other organizers in cc, *Mark as sent*.
- **Speaker responses**: what speakers submit through the form. *Assign to slot* fills the
  session (name, title, abstract, links, recording consent) and sets it to confirmed.
- **Series**: one row per date; inline status, invitation status and the N/L/B/W promotion
  cells; the row opens the full session with newsletter, LinkedIn and Bluesky drafts.
- **Messages**: channels #general, #speakers, #promo, #random, direct messages, threads,
  reactions, @mentions, a pinned note. History is kept for good.
- **Reminders** (Series view): exports an .ics with one calendar reminder per session and duty,
  Berlin time: the chair pings the speaker two weeks before (10:00), the invitation newsletter with
  the Zoom link goes out one week before (10:00), the reminder newsletter on the day (09:00), plus
  the session itself with a 30-minute alert. Import the file once into Google Calendar (Settings → Import &
  export), Outlook or Apple Calendar; re-export after the programme changes (same UIDs, so a
  re-import updates rather than duplicates in most calendars). The session drawer offers the same
  four reminders as prefilled Google Calendar links. Nothing runs on a server: the reminders live in
  each organizer's own calendar, which is also what rings on the phone.
- **Slack reminders (automatic)**: a GitHub Actions job in the site repository
  (`.github/workflows/tada-slack-reminders.yml`, script `.github/scripts/tada_slack_reminders.py`) runs every hour,
  reads the duties list that *Publish to website* writes to Firestore (`public/duties`: dates, speakers, chairs by
  name; no e-mails, no Zoom links) and posts to the organizers' Slack channel, Berlin time, at 09:30: 14 days
  before (chair pings the speaker; the inviter creates the Zoom meeting and puts the link in the e-mail), 7 days
  before (invitation newsletter with the Zoom link, LinkedIn, Bluesky) and on the session day (chair hosts,
  reminder newsletter with the Zoom link, reminder posts). One-time setup: (1) in Slack, https://api.slack.com/apps → *Create New App* → *From
  scratch* → name "TaDa reminders", workspace tadapolisci → *Incoming Webhooks* → activate → *Add New Webhook to
  Workspace* → pick the organizers' channel → copy the URL; (2) on GitHub, repository *Settings → Secrets and
  variables → Actions → New repository secret* named `SLACK_WEBHOOK_URL` with that URL; (3) *Actions → TaDa Slack
  reminders → Run workflow* with "Post a test message" ticked. Set the chairs in the Series view and press
  *Publish to website* whenever the programme or the chairs change, otherwise the reminders name nobody.
- **Social card** (session drawer, or `/tadawebsite/card/`; organizer sign-in required, same accounts as this app; also makes the term poster, format "Term poster"): renders the announcement image for
  LinkedIn and Bluesky (photo on the blue panel, date badge, name, title; red badge when the session
  is not on a Wednesday) and downloads it as PNG, square or landscape. Uses the portrait stored in
  `assets/speakers/` (photos from other websites cannot be exported by the browser; upload them or
  add them to the repo, named `YYYY-MM-DD-first-last.jpg`, square, about 800 px).
- **Post drafts** (LinkedIn, Bluesky) follow the wording of the spring 2026 posts; attach the social card.
- **Newsletter sign-up** (public page, "Subscribe to the newsletter"): the form posts straight to the tada.cool
  mailing list on IONOS (`ml.kundenserver.de`, list `news@tada.cool`), the same sign-up as on the old Google Site;
  the list is administered in Christopher's IONOS account. Bluesky/LinkedIn links on the page show up only once a
  real profile URL is set in `committee/config.js`.
- **Logo files**: `assets/tada-logo.png` (1024 px, transparent) is used everywhere on the site and in the cards.
  It is the "TaDa · SPEAKER SERIES" badge (Sep 2026): the official "READING GROUP" master
  (`assets/brand/tada-logo-transparent.png`, brand colours #274387 dark blue, #3AB8EF light blue) with the
  bottom arc re-lettered in Poppins Bold and the ring closed up to the text; the result is kept as
  `assets/brand/tada-logo-speaker-series.png`. Favicons, `og-image.png` and `tada-logo-384.png` derive from it.
  For a vector version, ask the original designer to change the wording in the source file. Social-media profile and cover versions are in the
  organizers' shared logo package (final.zip), not in the repo.

## What lives where
| Data | Firestore collection | Who can read | Who can write |
| --- | --- | --- | --- |
| Organizer profiles (incl. read markers) | `members/{uid}` | organizers | the person themselves |
| Sessions, invitation + promo status, drafts | `sessions/{date}` | organizers | organizers |
| Candidate speakers | `candidates/{id}` | organizers | organizers |
| Speaker form submissions | `responses/{id}` | organizers | anyone may create; organizers update/delete |
| Team messages (channel, thread, reactions) | `messages/{id}` | organizers | author; anyone may react |
| Pinned note, allow-list, term settings | `settings/{id}` | organizers | organizers |
| Public programme (what the website shows) | `public/programme` | everyone | organizers |

## Troubleshooting
- **"Not allowed: check the Firestore rules or the organizer allow-list"** → the rules are not
  published (step 3) or the address is missing from the allow-list (step 4.3).
- **`auth/unauthorized-domain`** → add the domain in step 2.3.
- **Speaker form says "could not submit (permission-denied)"** → the `responses` rules are not published.
- **Programme on the public page does not update** → press *Publish to website* in Series.
