# AwaBus

AwaBus is a multi-tenant school bus platform for Ghana. Schools follow their
buses live, parents are told when their child boards and when the bus is near
home, and drivers run each trip from a native mobile app.

| Part | What it is | Built with |
|---|---|---|
| [`server/`](./server) | REST API, live-tracking feed, SMS and voice integration | Node, Express, MongoDB (Mongoose), Socket.io |
| [`admin/`](./admin) | Admin Portal for school staff, plus a Superadmin area for the platform owners | React, Vite, Tailwind |
| [`driver/`](./driver) | Driver App for Android and iOS | React Native, Expo (Expo Router, EAS) |

## What it does

**For schools (Admin Portal)**
- Manage routes, buses, drivers and students (with guardians, photos, home
  location and a notification zone for each child). Add records one by one or
  upload them from spreadsheets (samples in [`docs/sample-uploads`](./docs/sample-uploads)).
- Follow every running trip on a live map, with each student's status, the
  bus position trail, and the parent alert and call result for each child.
- Trip history with timelines, delays and what happened to each student.
- Cancel a child's morning or afternoon ride on a parent's behalf.
- Notifications, a help guide, dark mode, and responsive screens.

**For drivers (Driver App)**
- Sign in with a phone number, see today's trip, take attendance, start the trip.
- Scan students on and off the bus. The nearest child is shown first, with
  search, directions to the next stop and the parent's contact.
- Keeps working through weak signal: scans and GPS points are queued on the
  phone and sent when the connection returns.
- Text one parent, or send an SMS to all waiting parents (for example when late).
- Share a code with a teacher on bus duty (the **bus assistant**), who can help
  with roll call, boarding, messages and GPS from their own phone.

**For parents**
- A text when their child boards the bus or is dropped off.
- A phone call when the bus is near home. A missed call is itself the alert,
  and no text follows it. Each call's result shows on the student's card.
- Choose a language for calls (English, Twi, Ewe, Hausa) and switch arrival
  calls on or off per child.

**For the platform owners (Superadmin)**
- Create, suspend and support schools, with platform-wide figures.
- A **System** page with server health, the message log, recent errors, the
  provider settings that are switched on, and a **live test** that sends SMS
  and calls to your own numbers on a timer, so the integrations can be checked
  without a bus on the road.

## How it fits together

```
 Driver App  ──►  API (Express)  ◄──  Admin Portal
 (GPS, scans)      │   │   │         (live map via Socket.io)
                   │   │   └── MongoDB (one database, every record tagged by school)
                   │   └────── Arkesel: SMS and outbound voice calls
                   └────────── call results come back to /api/webhooks/voice/<token>
```

- **Multi-tenant.** Each school's data is isolated by a `school` field and a
  Mongoose plugin ([`server/src/plugins/tenantScope.js`](./server/src/plugins/tenantScope.js));
  the school comes from the sign-in token. Platform-wide work is done
  explicitly in a "system" context.
- **Parent alerts** ([`server/src/services/parentAlerts.js`](./server/src/services/parentAlerts.js)):
  boarding texts, a "near home" call when the bus enters a child's zone (once
  per family per trip), and the result of each call.
- **Messaging** ([`server/src/services/messaging`](./server/src/services/messaging)):
  every SMS goes through one function, is logged, and uses Arkesel when it is
  switched on. Voice calls are in [`server/src/services/voice`](./server/src/services/voice).
- **Ride cancellations** ([`server/src/services/rideCancellations.js`](./server/src/services/rideCancellations.js)):
  the rules for a parent cancelling a morning or afternoon ride are written and
  used by the school office. A phone menu (IVR) for parents to cancel by calling
  is **not connected yet**; it needs an inbound voice provider.

## Run it locally

You need Node 18 or newer and a MongoDB database (local or Atlas).

```bash
# 1. API
cd server
cp .env.example .env     # set MONGO_URI and JWT_SECRET at least
npm install
npm run dev              # http://localhost:5000

# 2. Admin Portal (new terminal)
cd admin
cp .env.example .env
npm install
npm run dev              # http://localhost:5173

# 3. Driver App (new terminal) - see driver/README.md
cd driver
cp .env.example .env     # point EXPO_PUBLIC_API_URL at your API
npm install
npm start
```

**First sign-in.** Create the platform owner account once, then sign in to the
Admin Portal and create a school from the Superadmin area:

```bash
cd server
MONGO_URI=... SEED_SUPERADMIN_EMAIL=you@example.com SEED_SUPERADMIN_PASSWORD='...' \
SEED_SUPERADMIN_NAME='Your Name' SEED_SUPERADMIN_PHONE=0241234567 \
node src/scripts/seedSuperadmin.js
```

The superadmin gives each new school admin a one-time setup code to create their
password; school admins do the same for their drivers.

## Configuration

All settings are environment variables; [`server/.env.example`](./server/.env.example)
documents each one. Only `MONGO_URI` and `JWT_SECRET` are needed to start.

| Group | Variables | Notes |
|---|---|---|
| Core | `MONGO_URI`, `JWT_SECRET`, `NODE_ENV`, `PORT` | Use `NODE_ENV=production` when live |
| Web access | `CLIENT_URL`, `CLIENT_URL2`, `DEPLOYED_URL` | Admin site addresses allowed to call the API |
| SMS (Arkesel) | `SMS_PROVIDER=arkesel`, `ARKESEL_API_KEY`, `ARKESEL_SENDER_ID`, `ARKESEL_SANDBOX` | Needs an approved sender ID; sandbox sends nothing |
| Arrival calls | `VOICE_PROVIDER=arkesel`, `ARKESEL_VOICE_FILE_URL`, `ARKESEL_VOICE_ID`, `VOICE_WEBHOOK_TOKEN`, `SERVER_PUBLIC_URL` | The audio must be a real MP3 or WAV; `ARKESEL_VOICE_ID` is the caller number parents see |
| Alerts | `PARENT_ALERTS` | On by default; set `false` to switch alerts off |

Without provider settings, messages are written to the server log instead of
being sent, so the rest of the app can be tried safely.

## Deployment

- **API** on a Node host such as Render (root of the repo, commands run in `server/`).
- **Admin Portal** on a static host such as Vercel (`admin/`, build `npm run build`).
- **Driver App** is built and updated with EAS; see [`driver/README.md`](./driver/README.md).
- The arrival-call message is served by the API at `/voice/school-bus.mp3`; replace
  the file in `server/public/voice/` to change the recording.

Before real use, check the live server has `NODE_ENV=production`, that the
demo switches are off (`TRIP_SIMULATOR` unset or `false`, `ARKESEL_SANDBOX=false`,
`RATE_LIMITS` unset), and that the voice recording is final.

## Project status and next steps

- Working: school management, live tracking, driver app, parent texts and arrival
  calls with results, the bus assistant, ride cancellations by the office, spreadsheet import.
- Not yet connected: parents cancelling a ride by phone (IVR), and call recordings
  in Twi, Ewe and Hausa.
- There is no automated test suite yet. The System page's live test and the
  providers' sandbox modes are the main ways to check the integrations.

## About how this was built

AwaBus was built by the AwaBus team, with AI coding assistance used for parts of
the code. The team reviews and tests what ships.
