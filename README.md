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
- Optional `GROQ_MODEL`: defaults to `llama-3.3-70b-versatile`.

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
The public App ID is configured in `public/index.html`. Configure your deployed HTTPS domain and web push settings in OneSignal. Browser permission is requested only when the user interacts with OneSignal's own prompt/settings; automatic release campaigns and REST API sending still need a server-side notification workflow.

## Current implementation status
Implemented in this build:
- Email/password registration and sign-in.
- Google sign-in (requires enabling provider and authorized domains in Firebase).
- Firestore per-user watchlist.
- TMDB multi-search API proxy (requires `TMDB_API_KEY`).
- VISION chat UI and Groq API proxy (requires `GROQ_API_KEY`).
- OneSignal SDK initialization and service worker.

Still to build:
- Persistent VISION chat history in Firestore.
- Release calendar/countdowns and scheduled release reminders.
- Server-side OneSignal notification sending and subscription/user mapping.
- Watch history, personalized recommendations, and advanced VISION tools.
- Authentication verification/rate limiting on API endpoints before public production use.

TMDB attribution and usage terms apply. The app is not affiliated with or endorsed by TMDB.
