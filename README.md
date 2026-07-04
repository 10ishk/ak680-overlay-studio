# AK680 Overlay Studio

AK680 Overlay Studio is a desktop overlay controller for the AJAZZ AK680 V2. It provides a modern React UI that controls the embedded official AJAZZ web driver through safe route and DOM adapters.

The embedded official driver remains responsible for actual keyboard communication through WebHID. AK680 Overlay Studio does not include native HID writes, packet sending, a packet editor, a command console, or SOCD packet automation.

## Status

Current status: overlay-control MVP.

The app has pivoted from logger-first to control-first. Logging remains available for future native development and debugging, but the primary workflow is now:

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

The app opens an Electron window with the overlay shell and the official driver loaded from `https://ajazz.driveall.cn/`.

## Checks

```bash
npm run typecheck
npm run build
npm run lint
```

## Connect AK680 V2

1. Plug in the AJAZZ AK680 V2.
2. Click **Connect AK680 V2** on Dashboard.
3. Approve the browser/WebHID permission prompt if shown.
4. If the official page needs manual confirmation, use **Official View: Docked** and complete the official flow.

Connection status is derived from observed WebHID events, official DOM activity, route state, and known AK680 V2 metadata where available. The app does not fake connected status.

## Official View Modes

- **Docked**: full official webview is visible for inspection and manual fallback.
- **Compact**: small inspector/debug view while the overlay is primary.
- **Hidden**: official webview stays mounted and connected but visually de-emphasized.

The webview remains mounted so official app state and WebHID connection can stay alive.

## Overlay Controls

- **Lighting**: effect cards, brightness/speed sliders, RGB/Monochrome mode, and swatches. These use official DOM commands such as visible-text clicks and range updates where controls are found.
- **Performance**: preset buttons, Normal/Advanced/Recalibrate sections, trigger distance, fast trigger, dead-zone controls, and recalibrate action.
- **Advanced Keys / SOCD**: route-backed cards for RS/Snappy, SOCD, DKS, MT, and TGL. SOCD stays conservative and only opens/finds official UI.
- **Keymap**: keyboard preview, selected-key guidance, and route-backed selected-key lookup.
- **Macros**: opens macro route and tries visible macro manager/new/recording controls when found.
- **Settings**: theme/app settings plus official settings shortcuts. Destructive reset is never clicked automatically; it only opens the official settings page.

DOM selectors may need adjustment if the AJAZZ site changes. When a control is not found, the action history reports a failure and the user can fall back to the visible official driver.

## Logging and Export

Logging is secondary but still active. The guest preload observes:

- WebHID request/get device calls
- HID open/close
- sendReport, sendFeatureReport, receiveFeatureReport
- inputreport events
- DOM clicks, inputs, changes, and route changes
- overlay adapter command results
- host WebHID permission events

Exports include overlay action history, webview mode, adapter command results, capture session data, markers, and HID/DOM logs. Logs are downloaded only when you click **Export JSON** and are not uploaded or written automatically to the repo.

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

## Enjoy

Use the overlay for the clean day-to-day control surface, and keep the official view available whenever the AJAZZ page needs a manual confirmation.
