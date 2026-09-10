# TaDa Executive Committee — setup and how it fits together

The committee area is a static page in this repository plus a free Firebase project
(`tadawebsite`) that provides the logins and the shared database. Nothing is billed on the
free "Spark" plan at this size (four users, a few hundred documents).

Console: https://console.firebase.google.com/project/tadawebsite

## Pages
| URL | What it is |
| --- | --- |
| `/tadawebsite/` | Public site: next session, programme, join band, archive, organizers. Reads `data/talks.json` and, when published, the live programme from Firestore. |
| `/tadawebsite/speak/` | Speaker form linked from invitation e-mails: title, abstract, available dates (the open slots), recording consent. Writes to Firestore `responses`. |
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
