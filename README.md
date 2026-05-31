# Superset Trainer

Superset is a browser-based gym trainer app built for mobile-first use. It keeps client data, workout programs, session logs, and the exercise library inside the browser so it is easy to run locally or host as a static site.

## Features

- Client manager with editable contact details, goals, notes, and body measurements
- Measurement history timeline per client check-in
- Program builder for assigning exercises to a client, including duplicate-program support
- Program templates for strength, hypertrophy, and fat-loss workflows
- Session mode for logging workout sets on the gym floor with rest timer alerts and quick set presets
- Previous-session comparison while running a live workout
- Undo last edit while tracking a live session
- Weekly check-in reminder list for clients due an update
- Session booking calendar with upcoming schedule list
- Current-week scheduler view with day columns and time-positioned bookings
- Recurring weekly booking creation with per-week rescheduling
- Per-client and full-schedule `.ics` calendar export
- Session trend analytics (weekly sets, reps, and load)
- Editable exercise library with search and a large starter catalog
- Search filters for clients, programs, and exercises
- Modal-based editors with unsaved-changes confirmation
- Archive and restore workflows for clients and programs (instead of immediate hard delete)
- Client check-in questionnaire with saved check-in history
- Local browser storage with JSON backup export and import
- CSV export for client progress data (measurements and check-ins)
- Client-facing update output from programs (copy to clipboard or download text file)
- Printable client summary output for handoff or in-person review
- Lightweight trainer PIN lock screen for local privacy
- Installable PWA support for Android home-screen usage

## Run Locally

```bash
npm install
npm run dev
```

## Build For Hosting

```bash
npm run build
```

The production output is written to `dist/`. You can host that folder on GitHub Pages, a static file host, or any web server.

## GitHub Pages

This repo is ready for GitHub Pages deployment using GitHub Actions.

1. Create a new GitHub repository and push this project to it.
2. In the repository settings, enable Pages and select the GitHub Actions source.
3. Push to `main` and the workflow in `.github/workflows/deploy.yml` will build and publish the site.

After deployment, Chrome on Android can install the app from the GitHub Pages URL using the browser menu.

## Notes

- Data is stored in the browser on the device that is using the app.
- Use the export/import buttons in the header if you want to move data between devices or make a backup.
- If you want shared multi-user sync later, this app can be extended with a backend.