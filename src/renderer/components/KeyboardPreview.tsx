import type { CSSProperties } from "react";
import { ak680Layout, AK680_LAYOUT_HEIGHT, AK680_LAYOUT_WIDTH, Ak680Key } from "../data/ak680Layout";
import "./KeyboardPreview.css";

export type KeyboardLightingMode = "rainbow" | "solid" | "off";

type KeyboardPreviewProps = {
  lightingMode?: KeyboardLightingMode;
  accentColor?: string;
  selectedKey?: string;
  onKeySelect?: (keyId: string, key: Ak680Key) => void;
};

export function KeyboardPreview({
  lightingMode = "rainbow",
  accentColor = "#7f8cff",
  selectedKey,
  onKeySelect
}: KeyboardPreviewProps) {
  return (
    <div
      className={`keyboardPreview lighting-${lightingMode}`}
      style={{
        "--keyboard-columns": AK680_LAYOUT_WIDTH,
        "--keyboard-rows": AK680_LAYOUT_HEIGHT,
        "--keyboard-accent": accentColor
      } as CSSProperties}
      aria-label="AJAZZ AK680 V2 keyboard preview"
    >
      <div className="keyboardPreview__handle" />
      <div className="keyboardPreview__case">
        <div className="keyboardPreview__glow" />
        <div className="keyboardPreview__keys">
          {ak680Layout.map((key) => {
            const hue = Math.round((key.x / AK680_LAYOUT_WIDTH) * 265 + (key.y / AK680_LAYOUT_HEIGHT) * 55 + 145);
            const glow = lightingMode === "off" ? "transparent" : lightingMode === "solid" ? accentColor : `hsl(${hue} 92% 62%)`;
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
                onClick={() => onKeySelect?.(key.id, key)}
              >
                <span className="keyboardPreview__shine" />
                <span className="keyboardPreview__label">
                  {key.secondary && <small>{key.secondary}</small>}
                  {key.label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="keyboardPreview__knob" />
      </div>
    </div>
  );
}
