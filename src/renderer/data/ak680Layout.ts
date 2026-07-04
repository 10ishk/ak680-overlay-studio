export type Ak680KeyType = "normal" | "modifier" | "space" | "nav";

export type Ak680Key = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  secondary?: string;
  type?: Ak680KeyType;
};

export const AK680_LAYOUT_WIDTH = 16.5;
export const AK680_LAYOUT_HEIGHT = 5;

export const ak680Layout: Ak680Key[] = [
  { id: "esc", label: "Esc", x: 0, y: 0, w: 1, h: 1, type: "modifier" },
  { id: "1", label: "1", secondary: "!", x: 1, y: 0, w: 1, h: 1 },
  { id: "2", label: "2", secondary: "@", x: 2, y: 0, w: 1, h: 1 },
  { id: "3", label: "3", secondary: "#", x: 3, y: 0, w: 1, h: 1 },
  { id: "4", label: "4", secondary: "$", x: 4, y: 0, w: 1, h: 1 },
  { id: "5", label: "5", secondary: "%", x: 5, y: 0, w: 1, h: 1 },
  { id: "6", label: "6", secondary: "^", x: 6, y: 0, w: 1, h: 1 },
  { id: "7", label: "7", secondary: "&", x: 7, y: 0, w: 1, h: 1 },
  { id: "8", label: "8", secondary: "*", x: 8, y: 0, w: 1, h: 1 },
  { id: "9", label: "9", secondary: "(", x: 9, y: 0, w: 1, h: 1 },
  { id: "0", label: "0", secondary: ")", x: 10, y: 0, w: 1, h: 1 },
  { id: "minus", label: "-", secondary: "_", x: 11, y: 0, w: 1, h: 1 },
  { id: "equals", label: "=", secondary: "+", x: 12, y: 0, w: 1, h: 1 },
  { id: "backspace", label: "Backspace", x: 13, y: 0, w: 2, h: 1, type: "modifier" },
  { id: "home", label: "Home", x: 15, y: 0, w: 1, h: 1, type: "nav" },

  { id: "tab", label: "Tab", x: 0, y: 1, w: 1.35, h: 1, type: "modifier" },
  { id: "q", label: "Q", x: 1.35, y: 1, w: 1, h: 1 },
  { id: "w", label: "W", x: 2.35, y: 1, w: 1, h: 1 },
  { id: "e", label: "E", x: 3.35, y: 1, w: 1, h: 1 },
  { id: "r", label: "R", x: 4.35, y: 1, w: 1, h: 1 },
  { id: "t", label: "T", x: 5.35, y: 1, w: 1, h: 1 },
  { id: "y", label: "Y", x: 6.35, y: 1, w: 1, h: 1 },
  { id: "u", label: "U", x: 7.35, y: 1, w: 1, h: 1 },
  { id: "i", label: "I", x: 8.35, y: 1, w: 1, h: 1 },
  { id: "o", label: "O", x: 9.35, y: 1, w: 1, h: 1 },
  { id: "p", label: "P", x: 10.35, y: 1, w: 1, h: 1 },
  { id: "bracket-left", label: "[", secondary: "{", x: 11.35, y: 1, w: 1, h: 1 },
  { id: "bracket-right", label: "]", secondary: "}", x: 12.35, y: 1, w: 1, h: 1 },
  { id: "backslash", label: "\\", secondary: "|", x: 13.35, y: 1, w: 1.65, h: 1 },
  { id: "delete", label: "Delete", x: 15, y: 1, w: 1, h: 1, type: "nav" },

  { id: "caps-lock", label: "Caps Lock", x: 0, y: 2, w: 1.65, h: 1, type: "modifier" },
  { id: "a", label: "A", x: 1.65, y: 2, w: 1, h: 1 },
  { id: "s", label: "S", x: 2.65, y: 2, w: 1, h: 1 },
  { id: "d", label: "D", x: 3.65, y: 2, w: 1, h: 1 },
  { id: "f", label: "F", x: 4.65, y: 2, w: 1, h: 1 },
  { id: "g", label: "G", x: 5.65, y: 2, w: 1, h: 1 },
  { id: "h", label: "H", x: 6.65, y: 2, w: 1, h: 1 },
  { id: "j", label: "J", x: 7.65, y: 2, w: 1, h: 1 },
  { id: "k", label: "K", x: 8.65, y: 2, w: 1, h: 1 },
  { id: "l", label: "L", x: 9.65, y: 2, w: 1, h: 1 },
  { id: "semicolon", label: ";", secondary: ":", x: 10.65, y: 2, w: 1, h: 1 },
  { id: "quote", label: "'", secondary: "\"", x: 11.65, y: 2, w: 1, h: 1 },
  { id: "enter", label: "Enter", x: 12.65, y: 2, w: 2.35, h: 1, type: "modifier" },
  { id: "page-up", label: "PgUp", x: 15, y: 2, w: 1, h: 1, type: "nav" },

  { id: "shift-left", label: "Shift", x: 0, y: 3, w: 2, h: 1, type: "modifier" },
  { id: "z", label: "Z", x: 2, y: 3, w: 1, h: 1 },
  { id: "x", label: "X", x: 3, y: 3, w: 1, h: 1 },
  { id: "c", label: "C", x: 4, y: 3, w: 1, h: 1 },
  { id: "v", label: "V", x: 5, y: 3, w: 1, h: 1 },
  { id: "b", label: "B", x: 6, y: 3, w: 1, h: 1 },
  { id: "n", label: "N", x: 7, y: 3, w: 1, h: 1 },
  { id: "m", label: "M", x: 8, y: 3, w: 1, h: 1 },
  { id: "comma", label: ",", secondary: "<", x: 9, y: 3, w: 1, h: 1 },
  { id: "period", label: ".", secondary: ">", x: 10, y: 3, w: 1, h: 1 },
  { id: "slash", label: "/", secondary: "?", x: 11, y: 3, w: 1, h: 1 },
  { id: "shift-right", label: "Shift", x: 12, y: 3, w: 2, h: 1, type: "modifier" },
  { id: "arrow-up", label: "Up", x: 14, y: 3, w: 1, h: 1, type: "nav" },
  { id: "page-down", label: "PgDn", x: 15, y: 3, w: 1, h: 1, type: "nav" },

  { id: "ctrl-left", label: "Ctrl", x: 0, y: 4, w: 1.15, h: 1, type: "modifier" },
  { id: "win", label: "Win", x: 1.15, y: 4, w: 1.15, h: 1, type: "modifier" },
  { id: "alt-left", label: "Alt", x: 2.3, y: 4, w: 1.15, h: 1, type: "modifier" },
  { id: "space", label: "Space", x: 3.45, y: 4, w: 6.6, h: 1, type: "space" },
  { id: "alt-right", label: "Alt", x: 10.05, y: 4, w: 1.15, h: 1, type: "modifier" },
  { id: "fn", label: "Fn", x: 11.2, y: 4, w: 1.15, h: 1, type: "modifier" },
  { id: "ctrl-right", label: "Ctrl", x: 12.35, y: 4, w: 1.15, h: 1, type: "modifier" },
  { id: "arrow-left", label: "Left", x: 13.5, y: 4, w: 1, h: 1, type: "nav" },
  { id: "arrow-down", label: "Down", x: 14.5, y: 4, w: 1, h: 1, type: "nav" },
  { id: "arrow-right", label: "Right", x: 15.5, y: 4, w: 1, h: 1, type: "nav" }
];
