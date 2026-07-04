# Changelog

## v0.1.0 MVP

First usable AK680 Overlay Studio prototype.

### Added

- Electron + React + TypeScript desktop shell.
- Visible official AJAZZ webview wrapper for `https://ajazz.driveall.cn/`.
- Narrow WebHID permission handling for the official AJAZZ origin.
- WebHID logger for request/get devices, open/close, reports, feature reports, and input reports.
- Conservative DOM/activity logger for clicks, inputs, changes, and route changes.
- Capture Session workflow with start/stop markers.
- Quick marker and custom marker system.
- Structured JSON export with session metadata and safety note.
- Dashboard, Logs, Settings, Official Driver, and placeholder feature pages.
- Safe route-level navigation to known official paths only.
- Theme system with Carbon Orange, Obsidian, Neon Blue, Violet, Frost, Matcha, and Terminal.

### Safety Model

- The official webview remains the only actor that can communicate with the keyboard.
- AK680 Overlay Studio observes/logs and performs route-level navigation only.
- No native HID writes.
- No packet sending.
- No packet editor.
- No command console.
- No SOCD automation.
- No AJAZZ assets or official screenshots are included.

### Known Limitations

- Feature pages are placeholders and do not write settings to the keyboard.
- HID packets are logged but not decoded into protocol-level meanings.
- Logs are kept in memory until manually exported.
- Webview logging depends on Chromium/Electron WebHID behavior and the official page continuing to use WebHID APIs.
- Runtime QA is smoke-level for this MVP; deeper hardware validation needs an AK680 V2 connected to the official driver flow.
