# NeedLoop – setup from an Android phone

Stack: plain HTML/CSS/JS + Firebase Auth + Cloud Firestore + GitHub Pages. No servers, no paid plan needed (Spark/free tier).

## 1. Firebase (console.firebase.google.com, in Chrome)
1. Project settings (gear) > Your apps > add Web app (</>) > copy the `firebaseConfig` values.
2. Build > Firestore > Rules tab > replace everything with the contents of `firestore.rules` > Publish.
3. Build > Authentication > Settings > Authorized domains > add `YOURNAME.github.io` (after step 2 below).
4. Make yourself admin: sign up on the live site, then Authentication > Users > copy your UID. Firestore > Start collection `admins` > Document ID = your UID > add any field (e.g. `ok` = true). Only you can do this; the app can never write to `admins`.

## 2. GitHub Pages (github.com in Chrome, "Desktop site" ticked)
1. Create a free account > New repository `needloop` (Public) > "uploading an existing file".
2. Unzip needloop.zip on your phone (Files app), upload `index.html`, `README.md`, `firestore.rules`, and create/upload `css/` and `js/` contents (GitHub's web uploader accepts folders on "Desktop site"; otherwise add files with "Add file > Create new file" typing `css/style.css` as the name and paste contents).
3. Edit `js/firebase-config.js` and paste your values.
4. Settings > Pages > Source: Deploy from branch > main / root > Save. Your site: `https://YOURNAME.github.io/needloop/`.

## Costs
Spark plan is free with daily limits (about 50k reads / 20k writes per day). It stops when exceeded rather than billing. Do NOT upgrade to Blaze unless you choose to. Set a budget alert if you ever do.

## Known limits (honest list)
- No Cloud Functions (they need the paid Blaze plan). So notifications are written by the sender's browser; rules limit them to "from you, to someone else", but a malicious member could still spam notifications. Moving this to a Cloud Function is the upgrade path.
- Badges are derived live from post counts, not stored. Richer badges (e.g. helpful answers) need a Function.
- Conversation "unread" is a simple flag per conversation.
- Post deletion leaves orphaned replies/requests (invisible, harmless).
- Moderation is delete/dismiss only; no user banning yet.
