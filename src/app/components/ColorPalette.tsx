'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { oklch, formatHex, formatHsl, converter } from 'culori';

const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

type ShadeNumber = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

function hexToOKLCH(hex: string) {
  const color = oklch(hex);
  if (!color || color.l === undefined) return { l: 0, c: 0, h: 0 };
  return {
    l: color.l * 100,
    c: color.c || 0,
    h: color.h || 0
  };
}

// Reference lightness patterns from analysis
const referenceLightness = {
  saturated: {
    50: 0.971,  // Average from saturated colors
    100: 0.936,
    200: 0.885,
    300: 0.808,
    400: 0.704,
    500: 0.637,
    600: 0.577,
    700: 0.505,
    800: 0.444,
    900: 0.396,
    950: 0.258
  },
  desaturated: {
    50: 0.985,  // Average from desaturated colors
    100: 0.968,
    200: 0.925,
    300: 0.870,
    400: 0.707,
    500: 0.553,
    600: 0.443,
    700: 0.372,
    800: 0.275,
    900: 0.210,
    950: 0.140
  }
};

// Reference chroma patterns from analysis
const referenceChroma = {
  saturated: {
    50: 0.015,
    100: 0.035,
    200: 0.070,
    300: 0.120,
    400: 0.190,
    500: 0.230,
    600: 0.240,
    700: 0.210,
    800: 0.180,
    900: 0.140,
    950: 0.090
  },
  desaturated: {
    50: 0.002,
    100: 0.004,
    200: 0.006,
    300: 0.010,
    400: 0.020,
    500: 0.025,
    600: 0.020,
    700: 0.015,
    800: 0.010,
    900: 0.005,
    950: 0.002
  }
};

function calculateSaturationWeight(chroma: number): number {
  // Determine how "saturated" a color is on a scale of 0-1
  // Below 0.03 chroma is considered fully desaturated
  // Above 0.15 chroma is considered fully saturated
  const MIN_CHROMA = 0.03;
  const MAX_CHROMA = 0.15;
  
  if (chroma <= MIN_CHROMA) return 0;
  if (chroma >= MAX_CHROMA) return 1;
  
  return (chroma - MIN_CHROMA) / (MAX_CHROMA - MIN_CHROMA);
}

function generateShades(baseL: number, baseC: number, baseH: number) {
  const oklchToRgb = converter('oklch', 'rgb');
  const saturationWeight = calculateSaturationWeight(baseC);
  
  return shades.map(shade => {
    const shadeKey = shade as ShadeNumber;
    
    // Interpolate lightness based on saturation weight
    const targetL = referenceLightness.desaturated[shadeKey] + 
      (referenceLightness.saturated[shadeKey] - referenceLightness.desaturated[shadeKey]) * saturationWeight;
    
    // Interpolate chroma based on saturation weight
    const baseChroma = referenceChroma.desaturated[shadeKey] + 
      (referenceChroma.saturated[shadeKey] - referenceChroma.desaturated[shadeKey]) * saturationWeight;
    
    // Scale chroma based on input color's chroma
    const chromaScale = Math.min(1.2, baseC / 0.15); // Allow slight boost for very saturated colors
    const targetC = baseChroma * chromaScale;

    // Create OKLCH color
    const oklchColor = { mode: 'oklch', l: targetL, c: targetC, h: baseH };
    
    // Convert to RGB and check if in gamut
    const rgbColor = oklchToRgb(oklchColor);
    if (!rgbColor || rgbColor.r === undefined) {
      // If out of gamut, reduce chroma until in gamut
      let newC = targetC;
      while (newC > 0) {
        newC -= 0.01;
        const newColor = oklchToRgb({ mode: 'oklch', l: targetL, c: newC, h: baseH });
        if (newColor && newColor.r !== undefined) {
          return {
            color: formatHex(newColor) || '#000000',
            oklch: `oklch(${(targetL * 100).toFixed(1)}% ${newC.toFixed(3)} ${Math.round(baseH)})`,
            hsl: formatHsl(newColor) || '',
            isKeyColor: false
          };
        }
      }
    }

    const hexColor = formatHex(rgbColor) || '#000000';
    
    return {
      color: hexColor,
      oklch: `oklch(${(targetL * 100).toFixed(1)}% ${targetC.toFixed(3)} ${Math.round(baseH)})`,
      hsl: formatHsl(rgbColor) || '',
      isKeyColor: false
    };
  });
}

export default function ColorPalette() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [baseColor, setBaseColor] = useState('#00FF1E');
  const [shadeColors, setShadeColors] = useState<Array<{ color: string; oklch: string; hsl: string; isKeyColor: boolean }>>([]);
  const [colorFormats, setColorFormats] = useState<{
    hex: string;
    rgb: string;
    hsl: string;
    oklch: string;
  }>({ hex: '', rgb: '', hsl: '', oklch: '' });

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const updateColorFormats = useCallback((hex: string) => {
    const color = oklch(hex);
    if (!color || color.l === undefined) return;

    const rgbColor = converter('oklch', 'rgb')(color);
    const hslColor = converter('rgb', 'hsl')(rgbColor);
    
    setColorFormats({
      hex: hex.toUpperCase(),
      rgb: formatHex(rgbColor),
      hsl: formatHsl(hslColor) || '',
      oklch: `oklch(${(color.l * 100).toFixed(0)}% ${(color.c || 0).toFixed(3)} ${Math.round(color.h || 0)})`
    });
  }, []);

  const updatePalette = useCallback((hex: string) => {
    const { l, c, h } = hexToOKLCH(hex);
    const newShades = generateShades(l / 100, c, h);
    setShadeColors(newShades);
    updateColorFormats(hex);
  }, [updateColorFormats]);

  useEffect(() => {
    updatePalette(baseColor);
  }, [baseColor, updatePalette]);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setBaseColor(color);
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto">
      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 mb-12">
        {shadeColors.map((colorData, index) => (
          <div
            key={shades[index]}
            className="bg-card text-card-foreground flex items-center gap-4 p-6 rounded-xl border border-border"
          >
            <div className="relative w-16 h-16">
              <div
                className="w-full h-full rounded-lg border border-border"
                style={{ backgroundColor: colorData.color }}
              />
              {colorData.isKeyColor && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-white ring-2 ring-black dark:ring-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-lg font-medium mb-2 text-foreground">
                Shade {shades[index]}
              </div>
              <div className="font-mono text-xs space-y-1 text-muted-foreground">
                <div>{colorData.color.toUpperCase()}</div>
                <div>{colorData.oklch}</div>
                <div>{colorData.hsl}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="w-full flex flex-col gap-6 px-4">
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-4">
            <div className="flex flex-col gap-4">
              <input
                type="color"
                value={baseColor}
                onChange={handleColorChange}
                className="w-20 h-20 rounded-lg cursor-pointer border border-border"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xl font-medium text-foreground">Select base color</span>
              <div className="flex flex-col gap-1 font-mono text-sm text-muted-foreground">
                <div>{colorFormats.hex}</div>
                <div>{colorFormats.oklch}</div>
                <div>{colorFormats.hsl}</div>
              </div>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors border border-border"
            aria-label="Toggle theme"
          >
            <span className="text-xl">{theme === 'dark' ? '🌞' : '🌙'}</span>
          </button>
        </div>
      </div>
    </div>
  );
} 