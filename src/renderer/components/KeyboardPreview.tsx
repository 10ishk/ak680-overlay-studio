import type { CSSProperties } from "react";
import { ak680Layout, AK680_LAYOUT_HEIGHT, AK680_LAYOUT_WIDTH, Ak680Key } from "../data/ak680Layout";
import "./KeyboardPreview.css";

export type KeyboardLightingMode = "rainbow" | "solid" | "off";

type KeyboardPreviewProps = {
  lightingMode?: KeyboardLightingMode;
  accentColor?: string;
  selectedKey?: string;
  onKeySelect?: (keyId: string, key: Ak680Key) => void;
  compact?: boolean;
};

export function KeyboardPreview({
  lightingMode = "rainbow",
  accentColor = "#7f8cff",
  selectedKey,
  onKeySelect,
  compact = false
}: KeyboardPreviewProps) {
  const previewStyle = {
    "--keyboard-columns": AK680_LAYOUT_WIDTH,
    "--keyboard-rows": AK680_LAYOUT_HEIGHT,
    "--keyboard-accent": accentColor
  } as CSSProperties;

  return (
    <div
      className={`keyboardPreview lighting-${lightingMode} ${compact ? "is-compact" : ""}`}
      style={previewStyle}
      aria-label="AJAZZ AK680 V2 keyboard preview"
    >
      <div className="keyboardPreview__handle" />
      <div className="keyboardPreview__case">
        <div className="keyboardPreview__glow" />
        <div className="keyboardPreview__ledRail" />
        <div className="keyboardPreview__keys">
          {ak680Layout.map((key) => {
            const hue = Math.round(132 + (key.x / AK680_LAYOUT_WIDTH) * 146 + (key.y / AK680_LAYOUT_HEIGHT) * 10);
            const glow = lightingMode === "off" ? "transparent" : lightingMode === "solid" ? accentColor : `hsl(${hue} 92% 62%)`;
            const secondary = key.secondaryLabel ?? key.secondary;
            return (
              <button
                className={`keyboardPreview__key ${key.type ?? "normal"} ${selectedKey === key.id ? "selected" : ""}`}
                key={key.id}
                style={{
                  left: `${(key.x / AK680_LAYOUT_WIDTH) * 100}%`,
                  top: `${(key.y / AK680_LAYOUT_HEIGHT) * 100}%`,
                  width: `${(key.w / AK680_LAYOUT_WIDTH) * 100}%`,
                  height: `${(key.h / AK680_LAYOUT_HEIGHT) * 100}%`,
                  "--key-glow": glow
                } as CSSProperties}
                type="button"
                data-key-id={key.id}
                onClick={() => onKeySelect?.(key.id, key)}
                aria-pressed={selectedKey === key.id}
              >
                <span className="keyboardPreview__edge" />
                <span className="keyboardPreview__label">
                  {secondary && <small>{secondary}</small>}
                  {key.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
