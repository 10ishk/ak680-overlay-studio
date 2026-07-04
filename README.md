# AK680 Overlay Studio

AK680 Overlay Studio is an Electron + React + TypeScript overlay/wrapper prototype for the AJAZZ AK680 V2. It embeds the official AJAZZ web driver in a visible desktop webview and adds a separate modern shell for navigation, markers, and live logging.

The official webview performs real keyboard communication. This app observes WebHID and DOM activity from that webview, but it does not include native HID writes, packet sending, a packet editor, or a command console.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

The app opens an Electron window with the overlay shell and the official driver page at `https://ajazz.driveall.cn/`.

## Build

```bash
npm run build
```

## Connect AK680 V2

1. Plug in the AJAZZ AK680 V2.
2. Open the **Official Driver** page.
3. Use the official webview's connection flow.
4. Approve the WebHID prompt when it is requested by `https://ajazz.driveall.cn/`.

WebHID permission is scoped to the official AJAZZ origin for this prototype.

## Use the Official Webview

Open **Official Driver** from the sidebar or dashboard. The official webview is where real keyboard communication happens. AK680 Overlay Studio observes and labels activity only.

The shell can navigate the official webview to known route-level pages:

- `/custom-keys`
- `/lighting`
- `/macro`
- `/performance`
- `/advanced-keys`
- `/settings`

This is URL navigation only. The overlay does not click controls inside the official page, submit forms, automate SOCD, or send keyboard packets.

## Logging

Phase 3 logging is active. The official webview uses a guest preload logger that observes:

- `navigator.hid.requestDevice`
- `navigator.hid.getDevices`
- `HIDDevice.open` and `HIDDevice.close`
- `HIDDevice.sendReport`
- `HIDDevice.sendFeatureReport`
- `HIDDevice.receiveFeatureReport`
- `inputreport` events
- official page clicks, inputs, changes, route changes, and initial page load
- host-side WebHID permission decisions

HID logs include practical metadata such as timestamp, method, phase, report ID, packet length, uppercase hex bytes, raw byte arrays, device name, vendor ID, product ID, opened state, collection data, usage page/usage, current URL, and error summaries when available.

DOM logs are intentionally conservative. Passwords and obvious token/secret/auth fields are redacted. Normal text values are sanitized and capped at 80 characters. The app does not capture cookies, localStorage, sessionStorage, auth headers, or full page HTML.

## Add Markers

Use the log drawer or **Logs** page to add manual markers. Quick marker buttons are available for:

- SOCD baseline
- SOCD ON
- SOCD OFF
- RT 1.2mm
- Lighting Snowfall
- Macro Save
- Before change
- After change

You can also type a custom marker label. Markers appear in the live log, include the current official route, and are included in exported JSON.

## Capture Sessions

Use **Start Capture Session** before a manual test pass and **Stop Capture Session** when done.

- Starting a session adds a `Session started` marker.
- Stopping a session adds a `Session stopped` marker.
- Session state appears in the top bar and live log drawer.
- Session metadata is included in exported JSON.

Capture sessions are local, in-memory helpers only. They do not upload, persist, or write logs automatically.

## Export Logs

Click **Export JSON** or **Export Logs** to download the current in-memory event list. Exported files use names like `ak680-overlay-log-YYYYMMDD-HHMMSS.json`.

Exports include:

- app name and version
- export timestamp
- official page URL/current route
- latest device metadata
- event count and marker count
- capture session status, start time, end time, and session marker count
- full events array
- markers array
- safety note

Logs are not uploaded anywhere, are not written automatically to the repo, and are not persisted to disk unless you export them. Raw logs may contain device protocol data and should not be committed publicly unless intentionally reviewed, tiny, and redacted.

## What Works Now

- Electron desktop shell
- React renderer with dark-first responsive UI
- Persisted theme selector for Carbon Orange, Obsidian, Neon Blue, Violet, Frost, Matcha, and Terminal
- Visible official AJAZZ webview
- Route-level official webview navigation from overlay feature pages
- WebHID permission handling for the official AJAZZ origin
- Live WebHID logging from the embedded official webview
- Conservative DOM/activity logging from the embedded official webview
- Dashboard, feature placeholders, settings, and logs views
- Manual marker events with current official route
- Capture Session start/stop workflow with quick markers
- Structured JSON export and clear actions
- Adapter placeholder files for future official DOM control

## Current Limitations

- This is an overlay/wrapper prototype.
- The app does not include native HID writes or packet sending.
- Feature pages are placeholders and intentionally do not write to the keyboard.
- The official webview remains the only actor that writes to the keyboard.
- Overlay navigation is limited to known official URLs and does not operate controls inside the official web app.
- The logger observes calls and packets but does not decode the protocol yet.
- Logging is in-memory only until manual export.
- SOCD automation is not implemented.
- AJAZZ screenshots, copied assets, downloaded bundles, and snapshots of the official web app are not included or copied.
- Do not commit raw WebHID logs, private traces, serial numbers, tokens, secrets, cookies, local paths, user profile exports, browser cache/session data, generated build artifacts, or large research dumps.

## Enjoy

Use the official webview for real configuration today, and use the overlay shell to prepare cleaner workflows and logging for later phases.
