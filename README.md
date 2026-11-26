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


## Title details
Selecting a movie or TV poster/title opens a detail view powered by TMDB. It displays the synopsis, release date, community rating, genres, runtime or TV season/episode counts when available. TMDB attribution is shown in the detail view. The `/api/tmdb` endpoint supports both search (`?q=`) and detail lookup (`?id=&type=movie|tv`).


## Premiere countdown
The title details modal now shows a live days/hours/minutes/seconds countdown when TMDB provides a future movie release date or TV series first-air date. Once that date is reached, it changes to “Already premiered”. The countdown uses the device's local time zone and counts to the start of the listed release date; TMDB does not provide a precise premiere time through this endpoint.


## VISION 3.0 voice and personality

VISION now uses a consistent synthezoid persona and can generate spoken replies through Groq Orpheus TTS. The fixed signature voice is `daniel` (`canopylabs/orpheus-v1-english`). The existing `GROQ_API_KEY` environment variable is reused; no additional secret is required. Replies are split into short speech requests to respect Groq's 200-character input limit. The microphone uses the browser's built-in SpeechRecognition API where supported; microphone availability and permission prompts depend on the browser/device. Speech generation incurs Groq usage.


### TV episode countdowns
Upcoming episodes now display an individual live countdown in the season episode list. The countdown uses the air date returned by TMDB and counts to the start of that date in the visitor's local timezone. TMDB generally supplies a date rather than an exact premiere time, so the timer should not be interpreted as an exact release-hour guarantee. This display works for any TV series with upcoming episode air dates available from TMDB.


MOBILE CHAT VISIBILITY FIX: The VISION panel is hidden by default and opens only when its open class is applied. This prevents it from covering the REELORA movie interface on page load.


## Coming Soon discovery
The Coming Soon hub automatically loads upcoming movies and TV series across genres. The genre selector is optional and defaults to All genres. It uses the TMDB discover and genre endpoints through `/api/tmdb`. No additional environment variable is required beyond `TMDB_API_KEY`.


## Creator dashboard and visitor analytics
The verified account `artdark962@gmail.com` alone sees the Creator Settings tab. Email verification is required so an unverified registration cannot claim the creator address. The dashboard lists Firebase Authentication accounts (email, display name, creation time, last sign-in, enabled/disabled status) and recent site visit sessions/page views. Visitors who are not signed in are shown as anonymous session IDs. REELORA does not collect IP addresses or attempt to identify anonymous visitors.

Set `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel to the service-account JSON for the same Firebase project. The `firebase-admin` package is installed by the deployment. The `/api/creator` endpoint verifies Firebase ID tokens server-side and checks the creator email before returning user and visit data. Keep Firestore in production mode; do not add public read rules for `siteVisits` or `publicUserProfiles`. Existing `/users/{uid}` per-user rules can remain unchanged.

The dashboard can show accounts created through REELORA and their latest Firebase sign-in metadata. It cannot reveal people who browse privately without signing in as named individuals. Add a short privacy notice to your site explaining that basic visit/session analytics and account activity are recorded.
