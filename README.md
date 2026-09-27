# AwaBus

A multi-tenant school bus operations platform — live GPS tracking, route/
driver/student/bus management, trip history, and a native driver mobile app —
built as a MERN stack rebuild of the AwaBus Admin Portal and Driver App
designs.

## Repository layout

```
/server   Node/Express + MongoDB (Mongoose) API for the Admin Portal, the
          Driver App, and a platform-level Superadmin surface, plus a
          Socket.io live-tracking feed. Multi-tenant: every school's data is
          isolated via a `school` field + an AsyncLocalStorage-backed
          tenant-scoping plugin (see server/src/plugins/tenantScope.js).
/admin    The AwaBus Admin Portal — React + Vite + Tailwind. Every screen
          from the design (auth, dashboard, routes, drivers, students,
          buses, trip history, live tracking) plus a Superadmin "Platform"
          dashboard for creating/suspending schools.
/driver   The AwaBus Driver App — a native mobile app built with React
          Native + Expo (Expo Router, EAS Build). Sign in, a pre-trip roster
          with attendance toggling, live GPS trip tracking with offline
          queuing, delay SMS broadcasts to parents, trip/broadcast history,
          and settings. See driver/README.md for how to run it and build it
          with EAS.
```

## Quick start

### 1. Server

```bash
cd server
cp .env.example .env      # point MONGO_URI at your MongoDB instance
npm install
npm run seed               # wipes and repopulates the DB with demo data
npm run dev                # http://localhost:5000
```

A MongoDB instance is required (local `mongod`, Docker, or Atlas) — set
`MONGO_URI` in `server/.env` accordingly.

The seed script creates one demo school and prints ready-to-use credentials
for both apps, e.g.:

```
Admin Portal:
  school:   Awabus Demo School (AWA-001)
  email:    itsawabus@gmail.com
  password: Awabus@123

Driver App:
  phone:    +233244123456
  password: Driver@123
```

To create a platform superadmin (who can create/suspend schools from
`/platform` in the Admin Portal), run:

```bash
node src/scripts/seedSuperadmin.js
```

### 2. Admin Portal

```bash
cd admin
cp .env.example .env      # defaults to http://localhost:5000/api
npm install
npm run dev                # http://localhost:5173
```

Sign in with the admin email/password printed by the seed script. Admin
sign-in is email-based: enter an email, and the app either asks for your
password (existing account) or has you create one (first login for an
admin a superadmin just added).

### 3. Driver App

```bash
cd driver
cp .env.example .env      # point EXPO_PUBLIC_API_URL at your server (see driver/README.md)
npm install
npm start                  # opens the Expo dev tools
```

The Driver App is a native React Native/Expo app, not a website — run it in
Expo Go or a custom dev client on your phone, or build an installable APK/IPA
with EAS. Full setup, environment variable notes (physical devices can't use
`localhost`), and step-by-step `eas build`/`eas update` instructions live in
[`driver/README.md`](./driver/README.md).

Sign in with the driver phone/password printed by the seed script. The
first time a driver opens the app for a given day, their trip is
auto-provisioned from their current bus/route assignment — nothing needs
to be scheduled manually in the Admin Portal first.

## Multi-tenancy

Every tenant-owned model (`Admin`, `Driver`, `Bus`, `Route`, `Student`,
`Trip`) has a `school` field and the `tenantScope` Mongoose plugin
(`server/src/plugins/tenantScope.js`). Request-scoped tenant context is
carried via `AsyncLocalStorage` (`server/src/utils/tenantContext.js`) and
established once in `protectAdmin`/`protectDriver` from the JWT — every
controller downstream just calls `Model.find()`/`create()` etc as normal and
gets scoped automatically. Cross-tenant operations (seeding, the Superadmin
dashboard) opt in explicitly via `tenantContext.runAsSystem()`.

**Known gap:** `Guardian` is not yet tenant-scoped (no `school` field), so
guardian search/linking currently returns results across all schools. Worth
fixing before this goes further multi-school in production.

## What's implemented

**Server** — Multi-tenant auth: email-based admin sign-in (check-email →
enter/create password) with an OTP-based forgot-password flow, and
phone-based driver sign-in with its own OTP forgot-password flow. Full CRUD +
search/pagination/stats for Routes, Drivers (incl. a mock DVLA license
validation endpoint), Students (+ Guardians), Buses, Trip history, a Live
Tracking read API, a Superadmin namespace (school creation/suspension,
platform analytics), a full `/api/driver-app` namespace (login, today's
trip — auto-provisioned on first request, start/end trip, GPS pings,
attendance/boarding scans, delay SMS broadcasts, trip + broadcast history),
a Socket.io feed for live bus positions, and a demo GPS simulator so Live
Tracking has something to show without a live driver.

**Admin Portal** — Sign in / forgot password / OTP verification / reset
password, Dashboard, Routes (list, add, edit, delete), Drivers (list, profile,
5-step add wizard with license validation, edit), Students (list, profile,
5-step add wizard incl. guardian linking & geofencing, edit with an
interactive map picker), Buses (list, register, profile, edit), Trip History
(list + filters, trip detail with timeline & student progress), Live
Tracking (map with live bus markers via Socket.io, per-bus detail panel, trip
detail sub-view), and a Superadmin "Platform" dashboard. Dark mode,
responsive tables, empty/error/loading states, and reusable UI primitives
are shared across all of it.

**Driver App** (native, React Native + Expo) — Sign in (with wrong-password/
offline states), forgot password/OTP/reset, a pre-trip Home screen (driver +
bus/route card, attendance summary, tap-to-toggle student roster, Start Trip
confirmation), an Active Trip screen (live elapsed timer, on-device GPS via
`expo-location` pushed to the server, online/offline banner, a local action
queue backed by AsyncStorage that replays scans and GPS pings once
connectivity returns, a searchable boarding roster with haptic feedback on
scan), a Delay Broadcast flow (reason + message + live SMS preview → send →
delivery summary), an End Trip confirmation that warns about unscanned
students, a Trip Completed summary, Trip History + detail, Broadcast
History, and a Settings screen (profile, notification/vibration/theme/
auto-sync preferences persisted locally, Help & Support) plus a native
drawer navigation shell with `expo-secure-store`-backed auth.
