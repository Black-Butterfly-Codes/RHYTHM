# PRIVACY.md — RHYTHM Privacy Policy (prototype build)

*Last updated: October 2026. Mirrors the in-app Privacy view 1:1. If the two
ever disagree, this file plus the in-app text must be updated together.*

## 1. What this app is

RHYTHM is currently a **client-side prototype**. There is no RHYTHM server
and no cloud database. Everything the app stores lives in your own browser's
local storage, on your own device, and the app transmits nothing anywhere over
the network by itself.

## 2. Information you provide

- **Account data (signup):** name, username, email, password (see §3), date
  of birth, state/UT, city, bio, creative domains.
- **Content you create:** posts (titles, descriptions, lyrics text, track
  metadata), votes, comments, collaboration requests/messages/workspace files,
  auction listings, bids, direct messages, playlists, favourites, follows.
- **Demo seed data:** fresh installs include fictional demo users and posts
  so features are explorable immediately.

## 3. Passwords & sessions

Passwords are stored only as salted SHA-256 hashes — adequate for a demo,
not production grade (production will use Argon2id; see `AUTH.md`). Sessions
persist in local storage until logout. Five failed logins trigger a 60-second
lockout. Suspended accounts cannot log in.

## 4. Cookies & local storage

Keys used: app database, session id, login-attempt lockout. No third-party
cookies. Analytics code ships with the app but is **disabled until the owner
configures a measurement ID** — a default build makes zero analytics requests.

## 5. Sharing & third parties

None. Data does not leave your device through this app. Copied share links
contain only a track reference. Contacting support by email is governed by
your email provider's policy.

## 6. Retention & deletion

Data persists until you clear browser/site storage, use “Reset demo data”,
or delete your account (Profile → Delete my account), which purges your
posts, votes, comments, bids, chats, listings, notifications and profile from
the device (blocked while you have live auctions with bids or shared active
projects).

## 7. Security limitations

Browser local storage is **not encrypted** and is readable by scripts on the
same origin, so this prototype must not hold sensitive personal data.
Production hosting will add TLS, server-side authentication, encrypted
storage, access-controlled media and backups (see `DATA_SECURITY.md`).

## 8. Children

Intended for ages 13+. Date of birth is collected at signup.

## 9. Changes

Material changes will update this file, the in-app policy, and the date above.

## 10. Contact

Privacy questions via the in-app Contact page or the GitHub repository
(https://github.com/Black-Butterfly-Codes/RHYTHM). A dedicated support inbox
will be published by the owner (see `CONTACT.md`).
