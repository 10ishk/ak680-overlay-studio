# AK680 Overlay Studio

AK680 Overlay Studio is an Electron + React + TypeScript overlay/wrapper prototype for the AJAZZ AK680 V2. It embeds the official AJAZZ web driver in a visible desktop webview and adds a separate modern shell for navigation, markers, and future logging.

The official webview performs real keyboard communication. This app does not include native HID writes, packet sending, a packet editor, or a command console.

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

## Add Markers

Use the log drawer or **Logs** page to add manual markers such as:

- SOCD baseline
- SOCD ON
- SOCD OFF
- RT 1.2mm
- Lighting Snowfall
- Macro Save

These markers are local placeholder events for later WebHID and DOM logging work.

## Export Logs

Click **Export JSON** or **Export Logs** to download the current placeholder event list. Logs should not be committed unless they are tiny, redacted, and intentional.

## What Works Now

- Electron desktop shell
- React renderer with dark-first responsive UI
- Theme selector for Carbon Orange, Obsidian, Neon Blue, Violet, Frost, Matcha, and Terminal
- Visible official AJAZZ webview
- WebHID permission handling for the official AJAZZ origin
- Dashboard, feature placeholders, settings, and logs views
- Manual marker events
- JSON export and clear actions
- Adapter placeholder files for future official DOM control

## Current Limitations

- This is an overlay/wrapper prototype.
- The app does not include native HID writes or packet sending.
- Feature pages are placeholders and intentionally do not write to the keyboard.
- WebHID/DOM interception is not implemented yet.
- SOCD automation is not implemented.
- AJAZZ screenshots, copied assets, downloaded bundles, and snapshots of the official web app are not included or copied.
- Do not commit raw WebHID logs, private traces, serial numbers, tokens, secrets, cookies, local paths, user profile exports, browser cache/session data, generated build artifacts, or large research dumps.

## Enjoy

Use the official webview for real configuration today, and use the overlay shell to prepare cleaner workflows and logging for later phases.
