# TaDa Executive Committee — one-time setup (about 10 minutes)

The committee area is a static page in this repository plus a free Firebase project
(`tadawebsite`) that provides the logins and the shared database. Nothing is billed on the
free "Spark" plan at this size (four users, a few hundred documents).

Console: https://console.firebase.google.com/project/tadawebsite

## 1. Web app config → `committee/config.js` — DONE (10 Sep 2026)
1. Project settings (gear) → **General** → *Your apps* → **Web** (`</>`).
2. App nickname `TaDa website`, leave Firebase Hosting unticked → **Register app**.
3. Copy the `firebaseConfig = { ... }` object and paste it into `committee/config.js` as the
   value of `firebase:` (replace `null`). Commit and push.
   This config is public by design; access is controlled by the rules in step 5.

## 2. Logins (Authentication) — steps 1–3 DONE, step 4 is yours
1. Build → **Authentication** → Get started → **Sign-in method** → *Email/Password* →
   enable the first toggle only → Save.
2. **Settings** tab → *User actions* → **untick "Enable create (sign-up)"** → Save.
   This is what makes the accounts "for the team only": nobody can register themselves.
3. **Settings** → *Authorized domains* → Add `clintclaessen.com` and
   `clint-claessen.github.io` (add `tada.cool` when the site moves there).
4. **Users** tab → **Add user** once per organizer: institutional e-mail + a temporary
   password (the four organizers). Send each person their temporary password privately
   (WhatsApp). Everyone changes it under *Profile* after first login, and can change
   their e-mail there too.

## 3. Database (Cloud Firestore) — DONE (europe-west3, rules published)
1. Build → **Firestore Database** → **Create database**.
2. Location: `europe-west3 (Frankfurt)` (or the multi-region `eur3`). Cannot be changed later.
3. Start in **production mode** → Create.
4. **Rules** tab → replace everything with the contents of `committee/firestore.rules` → **Publish**.

## 4. First login
1. Open `https://clintclaessen.com/tadawebsite/committee/` and sign in.
2. *Profile*: set your display name, initials (used as chair/owner), and the sentence you use
   to introduce yourself in invitations (e.g. "a Postdoc at the University of Freiburg").
3. *Profile* → **Who may create an organizer profile**: paste the four organizer e-mails, one per line.
   From then on only those addresses can create a profile, even if sign-up were re-enabled.
4. *Series* → **Import Fall 2026** loads the five slots and the six candidates.
5. *Series* → **Edit theme / form link** → paste the Google Form link speakers use to pick a date.

## What lives where
| Data | Firestore collection | Who can read | Who can write |
| --- | --- | --- | --- |
| Organizer profiles | `members/{uid}` | organizers | the person themselves |
| Sessions of each term, invitation + promo status, drafts | `sessions/{date}` | organizers | organizers |
| Candidate speakers | `candidates/{id}` | organizers | organizers |
| Team messages | `messages/{id}` | organizers | author (delete own) |
| Pinned note, allow-list, term settings | `settings/{id}` | organizers | organizers |
| Public programme (what the website shows) | `public/programme` | everyone | organizers |

## Troubleshooting
- **"Not allowed: your e-mail is not on the organizer allow-list"** → the rules are not published
  (step 3.4) or the address is missing from the allow-list (step 4.3).
- **`auth/unauthorized-domain`** → add the domain in step 2.3.
- **"Not connected yet" on the login page** → `committee/config.js` still has `firebase: null`.
- **Programme on the public page does not update** → press *Publish to website* on the Series tab;
  speakers appear only when their status is *confirmed* or *done*.

## Privacy
Stored: organizer names/e-mails, speaker names/e-mails/abstracts, team messages. The database
sits in the EU region chosen in step 3.2. Deleting the Firebase project removes everything.
