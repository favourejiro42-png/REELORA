# REELORA

REELORA is a mobile-first entertainment tracker starter with Firebase Authentication, a Firestore watchlist, TMDB title search, a Groq-powered VISION assistant, and OneSignal web-push initialization.

## Deploy to Vercel
- Import this GitHub repository into Vercel.
- Framework preset: Other.
- Build command: leave blank.
- Output directory: `public`.
- Install command: leave default or `npm install`.

## Required Vercel Environment Variables
Set these in Project Settings → Environment Variables, then redeploy:
- `GROQ_API_KEY`: your private Groq key.
- `TMDB_API_KEY`: TMDB API Read Access Token.
- `ONESIGNAL_REST_API_KEY`: private OneSignal REST API key (reserved for server-side push sending).
- `ONESIGNAL_APP_ID`: `3df98de5-d865-4d92-b379-13fb5fe8f7ef`
- `GROQ_MODEL`: use `openai/gpt-oss-120b`.
- Optional `TAVILY_API_KEY`: enables live web research for VISION. Without it, VISION can still use TMDB title and episode metadata, but must not claim it searched the web.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete Firebase service-account JSON, stored only as a Vercel secret. Required by the scheduled release-alert job.
- `CRON_SECRET`: a long random secret used to protect the scheduled release-alert endpoint.

Never put secret keys in `public/`, frontend JavaScript, or GitHub.

## Firebase setup
Firebase project configuration is in `public/app.js`. Enable Email/Password and Google providers in Firebase Authentication. Create Firestore in Production mode and publish the REELORA rules below.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, create, update, delete: if request.auth != null && request.auth.uid == userId;
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## OneSignal
The public App ID is configured in `public/index.html`. Configure your deployed HTTPS domain and web push settings in OneSignal. Users sign in and tap Enable alerts to grant browser push permission and link their OneSignal subscription to their Firebase UID. A Vercel daily cron checks saved watchlist titles and sends a reminder one day before a known movie release or next TV episode date. This requires the service-account, OneSignal REST, and CRON secrets above. Push delivery also depends on browser/device permission and supported push settings.

## Current implementation status
Implemented in this build:
- Email/password registration and sign-in.
- Google sign-in (requires enabling provider and authorized domains in Firebase).
- Firestore per-user watchlist.
- TMDB multi-search API proxy (requires `TMDB_API_KEY`).
- VISION chat UI and Groq API proxy (requires `GROQ_API_KEY`).
- Automatic TMDB lookup for current release/episode questions.
- Optional Tavily live web research for VISION (requires `TAVILY_API_KEY`).
- Watchlist release-alert opt-in and OneSignal external-user linking.
- Daily Vercel cron for next-day movie/episode reminders (requires service-account and OneSignal secrets).
- OneSignal SDK initialization and service worker.

Still to build:
- Persistent VISION chat history in Firestore.
- Release calendar/countdowns and richer multi-day reminder controls.
- Watch history, personalized recommendations, and advanced VISION tools.
- Authentication verification/rate limiting on API endpoints before public production use.

TMDB attribution and usage terms apply. Add visible TMDB attribution in the UI before public launch. The scheduled alert job checks the first 300 user documents and up to 100 watchlist items per user per run; expand with pagination before scaling. The app is not affiliated with or endorsed by TMDB.
