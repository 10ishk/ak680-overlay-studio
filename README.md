# AK680 Overlay Studio

AK680 Overlay Studio is a desktop overlay controller for the AJAZZ AK680 V2. It provides a modern React UI that controls the embedded official AJAZZ web driver through safe route and DOM adapters.

The embedded official driver remains responsible for actual keyboard communication through WebHID. AK680 Overlay Studio does not include native HID writes, packet sending, a packet editor, a command console, or SOCD packet automation.

## Status

Current status: overlay-control MVP.

The app has pivoted from logger-first to control-first. Diagnostics remain available for future native development and adapter tuning, but the primary workflow is now:

1. Open the app.
2. Connect through the official AJAZZ webview.
3. Use the clean overlay pages for Lighting, Performance, Keymap, Advanced Keys, SOCD, Macros, and Settings.
4. The overlay navigates/clicks/changes official web controls where reliable text or selectors are available.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

The app opens an Electron window with the overlay shell and the official driver loaded at `https://ajazz.driveall.cn/custom-keys`.

## Checks

```bash
npm run typecheck
npm run build
npm run lint
```

## Connect AK680 V2

1. Plug in the AJAZZ AK680 V2.
2. Click **Connect AK680 V2** on Dashboard.
3. The overlay loads the official route, detects official page state, checks remembered WebHID devices from the official context, and tries a visible official **Connect** button after the user presses our button.
4. Approve the browser/WebHID permission prompt if shown.
5. If the official page needs manual confirmation, use **Official View: Docked** and complete the official flow.

Connection status is derived from observed WebHID events, official DOM activity, route state, and known AK680 V2 metadata where available. The app does not fake connected status.

## Official View Modes

- **Docked**: full official webview is visible for inspection and manual fallback.
- **Compact**: small inspector/debug view while the overlay is primary.
- **Hidden**: official webview stays mounted and connected but visually de-emphasized.

The webview remains mounted so official app state and WebHID connection can stay alive. Switching pages, themes, or Docked/Compact/Hidden mode should not remount the official page.

If the official view looks blank, use **Reload** or **Open Custom Keys** from the official view toolbar. The base official route can render a partial white page, so the overlay defaults to `/custom-keys` and only tries one automatic redirect from `/` per app start.

## Overlay Controls

- **Lighting**: effect cards, brightness/speed sliders, RGB/Monochrome mode, and swatches. These use official DOM commands such as visible-text clicks and range updates where controls are found.
- **Performance**: preset buttons, Normal/Advanced/Recalibrate sections, trigger distance, fast trigger, dead-zone controls, and recalibrate action.
- **Advanced Keys / SOCD**: route-backed cards for RS/Snappy, SOCD, DKS, MT, and TGL. SOCD stays conservative and only opens/finds official UI.
- **Keymap**: keyboard preview, selected-key guidance, and route-backed selected-key lookup.
- **Macros**: opens macro route and tries visible macro manager/new/recording controls when found.
- **Settings**: theme/app settings plus official settings shortcuts. Destructive reset is never clicked automatically; it only opens the official settings page.

DOM selectors may need adjustment if the AJAZZ site changes. When a control is not found, the action history reports a failure and the user can fall back to the visible official driver.

## Adapter Inspector

The **Adapter Inspector** is available from **Official Driver** and **Settings**. It provides developer-only DOM discovery buttons:

- Snapshot visible buttons
- Snapshot visible inputs
- Snapshot visible tabs
- Snapshot page text summary
- Snapshot selected/active elements

Snapshots include small structured records such as tag, role, text, aria-label, title, class summary, safe input value, checked/selected state, and bounding boxes. The inspector does not collect cookies, localStorage, sessionStorage, auth headers, or full HTML. Snapshots are not auto-exported and should not be committed.

## Diagnostics and Export

Diagnostics are secondary but still active. The guest preload observes:

- WebHID request/get device calls
- HID open/close
- sendReport, sendFeatureReport, receiveFeatureReport
- inputreport events
- DOM clicks, inputs, changes, and route changes
- overlay adapter command results and normalized success/failure details
- host WebHID permission events

Exports include overlay action history, adapter command results, device/connect status, webview visibility mode, official route, capture session data, markers, and HID/DOM activity logs. Diagnostics are downloaded only when you click **Export Diagnostics** and are not uploaded or written automatically to the repo.

Repeated DOM route/lifecycle diagnostics are throttled so the count should stay calm while idle. WebHID TX/RX packet observations are preserved because those are useful during real device testing.

Export filenames use `ak680-overlay-diagnostics-YYYYMMDD-HHMMSS.json`.

Do not commit raw logs, private traces, serial numbers, tokens, secrets, cookies, local paths, browser cache/session data, generated build artifacts, downloaded AJAZZ bundles, or official screenshots.

## Safety Model

- Official AJAZZ webview performs real keyboard communication.
- Overlay controls operate official DOM controls only.
- No native HID writes.
- No raw packet sending.
- No packet editor.
- No command console.
- No generic packet registry.
- No SOCD packet automation.
- No copied AJAZZ assets or screenshots.

## Current Limitations

- Live AJAZZ DOM selectors may need tuning as the official site changes.
- The AJAZZ page may still render blank internal sections; the overlay reports that as adapter readiness not confirmed and keeps route controls available.
- Some controls fall back to opening the official view when visible text or nearby sliders are not found.
- Recalibrate may open an official modal; the overlay does not click Save Calibration or Clear Calibration automatically.
- SOCD is route/find-only for now and does not configure SOCD settings.
- Keymap selected-key clicks are best-effort and may be ambiguous until official key positions are mapped.

## Enjoy

Use the overlay for the clean day-to-day control surface, and keep the official view available whenever the AJAZZ page needs a manual confirmation.
