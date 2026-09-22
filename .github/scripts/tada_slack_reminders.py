#!/usr/bin/env python3
"""TaDa organizer reminders for Slack.

Runs hourly from GitHub Actions (see .github/workflows/tada-slack-reminders.yml). Reads the duties list that the
committee app publishes to Firestore (public/duties: dates, speakers, chairs by name - no e-mails, no Zoom links)
and posts to the organizers' Slack channel through an incoming webhook (secret SLACK_WEBHOOK_URL).

Schedule, all in Berlin time (the workflow runs at xx:30, the script decides what is due):
  14 days before, 09:xx  chair pings the speaker (creates the Zoom meeting and puts the link in the e-mail)
   7 days before, 09:xx  invitation newsletter to the list (with the Zoom link) + LinkedIn / Bluesky posts
  session day,    09:xx  reminder to the chair + reminder newsletter with the Zoom link + reminder posts
Standard library only. `--dry-run` prints instead of posting; `--now` and `--duties-file` are for testing.
"""
import argparse
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

BERLIN = ZoneInfo("Europe/Berlin")
DUTIES_URL = "https://firestore.googleapis.com/v1/projects/tadawebsite/databases/(default)/documents/public/duties"
APP_URL = "https://clintclaessen.com/tadawebsite/committee/"
CARD_URL = "https://clintclaessen.com/tadawebsite/card/?date="


def fetch_duties(url: str) -> list:
    """The committee app stores the list as a JSON string in the field `json` of public/duties.
    A missing document (nothing published yet) means there is nothing to remind about."""
    req = urllib.request.Request(url, headers={"User-Agent": "tada-slack-reminders"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            doc = json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print("No duties list published yet (public/duties missing): press 'Publish to website' in the committee app.")
            return []
        raise
    raw = doc.get("fields", {}).get("json", {}).get("stringValue", "")
    return json.loads(raw) if raw else []


def when_label(s: dict) -> str:
    d = dt.date.fromisoformat(s["date"])
    return f"{d.strftime('%A %d %B %Y')}, {s.get('time') or '17:00'} Berlin time"


def due_messages(sessions: list, now: dt.datetime) -> list:
    today, hour = now.date(), now.hour
    out = []
    for s in sessions:
        if s.get("status") in ("cancelled", "declined") or not s.get("speaker"):
            continue
        try:
            days = (dt.date.fromisoformat(s["date"]) - today).days
        except (KeyError, ValueError):
            continue
        who = s["speaker"]
        title = f"“{s['title']}”" if s.get("title") else "(title to follow)"
        chair_name = s.get("chairName") or s.get("chair") or ""
        chair = chair_name or "chair not set yet"
        inviter = s.get("inviterName") or s.get("inviter") or ""
        when = when_label(s)
        card = CARD_URL + s["date"]
        if days == 14 and hour == 9:
            opener = (f"*{chair_name}*, please write" if chair_name
                      else "No chair is set for this session yet (set it in the committee app). Whoever invited the speaker, please write")
            zoom = " (Zoom links are made by the inviter" + (f", here {inviter}" if inviter else "") + ")"
            out.append(
                f":envelope: *Two weeks to go: ping the speaker* for the session on {when}.\n"
                f"{opener} to *{who}* {title}: confirm date and time, the 60-minute format "
                f"(20–30-minute talk, then discussion), ask for the final title, abstract, portrait and links, "
                f"and *create the Zoom meeting yourself and put the link in the e-mail*{zoom}. Drafts and details: {APP_URL}"
            )
        elif days == 7 and hour == 9:
            out.append(
                f":loudspeaker: *One week to go: invitation newsletter* for *{who}* {title} on {when}.\n"
                f"Send the newsletter to the list *with the Zoom link in it*, then the LinkedIn and Bluesky posts. "
                f"Drafts: open the session in the committee app ({APP_URL}) and click Generate / Newsletter. "
                f"Social card with photo: {card}"
            )
        elif days == 0 and hour == 9:
            out.append(
                f":calendar: *Today at {s.get('time') or '17:00'} Berlin time: {who}* {title}.\n"
                f"Chair *{chair}*: you host today. Everyone: reminder newsletter with the Zoom link to the subscribers, "
                f"and the reminder posts on LinkedIn and Bluesky."
            )
    return out


def post(webhook: str, text: str) -> None:
    body = json.dumps({"text": text}).encode("utf-8")
    req = urllib.request.Request(webhook, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        if r.status != 200:
            raise RuntimeError(f"Slack answered {r.status}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--now", help="pretend it is this Berlin date-time, e.g. 2026-10-07T09:31")
    ap.add_argument("--duties-file", help="read the duties list from a JSON file instead of Firestore")
    ap.add_argument("--dry-run", action="store_true", help="print the messages, do not post")
    ap.add_argument("--test", action="store_true", help="post one test message and exit")
    args = ap.parse_args()

    webhook = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
    now = dt.datetime.fromisoformat(args.now).replace(tzinfo=BERLIN) if args.now else dt.datetime.now(BERLIN)

    if args.test:
        msg = f":white_check_mark: TaDa reminders are connected to this channel (test message, {now:%Y-%m-%d %H:%M} Berlin time)."
        if args.dry_run or not webhook:
            print(msg)
        else:
            post(webhook, msg)
        return 0

    if args.duties_file:
        with open(args.duties_file, encoding="utf-8") as f:
            sessions = json.load(f)
    else:
        sessions = fetch_duties(DUTIES_URL)
    msgs = due_messages(sessions, now)
    print(f"{now:%Y-%m-%d %H:%M} Berlin: {len(sessions)} sessions in the duties list, {len(msgs)} reminder(s) due")
    for m in msgs:
        if args.dry_run or not webhook:
            print("---\n" + m)
        else:
            post(webhook, m)
    if msgs and not webhook and not args.dry_run:
        print("SLACK_WEBHOOK_URL is not set: nothing was posted (see committee/SETUP.md).", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
