declare module 'culori' {
  export type Color = {
    mode: string;
    l?: number;
    c?: number;
    h?: number;
    r?: number;
    g?: number;
    b?: number;
    s?: number;
  };

  export function oklch(color: string): Color | undefined;
  export function formatHex(color: Color | undefined): string;
  export function formatHsl(color: Color | undefined): string;
  export function converter(from: string, to: string): (color: Color) => Color;
} 