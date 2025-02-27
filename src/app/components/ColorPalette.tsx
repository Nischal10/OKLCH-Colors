'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { oklch, formatHex, formatHsl, converter } from 'culori';

type ShadeNumber = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
const shades: ShadeNumber[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

function hexToOKLCH(hex: string) {
  const color = oklch(hex);
  if (!color || color.l === undefined) return { l: 0, c: 0, h: 0, hsl_l: 0 };
  const hslColor = converter('oklch', 'hsl')(color);
  if (!hslColor || hslColor.l === undefined) return { l: 0, c: 0, h: 0, hsl_l: 0 };
  return {
    l: color.l,
    c: color.c || 0,
    h: color.h || 0,
    hsl_l: hslColor.l  // Add HSL lightness for better positioning
  };
}

// Patterns derived from reference colors
const colorPatterns = {
  // Average ratios for how chroma changes relative to the maximum chroma in each color
  chromaRatios: {
    50: 0.05,    // Very low chroma for lightest shade
    100: 0.12,   // Gradually increasing
    200: 0.25,
    300: 0.45,
    400: 0.75,
    500: 0.95,   // Near peak chroma
    600: 1.0,    // Peak chroma
    700: 0.85,   // Gradually decreasing
    800: 0.7,
    900: 0.55,
    950: 0.35    // Low chroma for darkest shade
  },
  // Standard lightness values (OKLCH)
  lightness: {
    50: 0.98,    // Lightest
    100: 0.95,
    200: 0.92,
    300: 0.86,
    400: 0.76,
    500: 0.68,   // Mid point
    600: 0.60,
    700: 0.52,
    800: 0.44,
    900: 0.32,
    950: 0.20    // Darkest
  },
  // HSL lightness mapping for positioning
  hslLightness: {
    50: 98,      // Lightest
    100: 95,
    200: 92,
    300: 86,
    400: 76,
    500: 68,     // Mid point
    600: 60,
    700: 52,
    800: 44,
    900: 32,
    950: 20      // Darkest
  }
};

function findClosestShade(hslLightness: number, oklchLightness: number): ShadeNumber {
  // Find the closest shade based on both HSL and OKLCH lightness values
  let closestShade: ShadeNumber = 500;
  let minDiff = Infinity;

  // Convert OKLCH lightness to percentage for easier comparison
  const oklchLightnessPercent = oklchLightness * 100;

  Object.entries(colorPatterns.hslLightness).forEach(([shadeStr, l]) => {
    const shade = Number(shadeStr) as ShadeNumber;
    
    // Give more weight to HSL lightness for better positioning
    const hslDiff = Math.abs(l - hslLightness) * 2; // Double weight for HSL
    const oklchDiff = Math.abs(colorPatterns.lightness[shade] * 100 - oklchLightnessPercent);
    
    // Weight HSL more heavily (2:1 ratio)
    const avgDiff = (hslDiff * 2 + oklchDiff) / 3;
    
    if (avgDiff < minDiff) {
      minDiff = avgDiff;
      closestShade = shade;
    }
  });

  return closestShade;
}

function generateShades(baseL: number, baseC: number, baseH: number, baseHslL: number) {
  const oklchToRgb = converter('oklch', 'rgb');
  
  // Find the closest shade based on both HSL and OKLCH lightness, with HSL weighted more heavily
  const baseShade = findClosestShade(baseHslL * 100, baseL);
  
  // Special handling for yellow hues (around 75-90 degrees)
  const isYellowish = baseH >= 70 && baseH <= 95;
  
  // Adjust max chroma based on hue - yellows need less chroma to maintain their hue
  const chromaCap = isYellowish ? 0.3 : 0.4;
  const maxChroma = Math.min(baseC / colorPatterns.chromaRatios[baseShade], chromaCap);
  
  return shades.map(shade => {
    // Calculate target lightness with smooth transition near base color
    let targetL = colorPatterns.lightness[shade];
    const distanceFromBase = Math.abs(shade - baseShade);
    
    if (shade === baseShade) {
      // Use exact base color values
      const oklchColor = { mode: 'oklch', l: baseL, c: baseC, h: baseH };
      const rgbColor = oklchToRgb(oklchColor);
      const hexColor = formatHex(rgbColor) || '#000000';
      
      return {
        color: hexColor,
        oklch: `oklch(${(baseL * 100).toFixed(1)}% ${baseC.toFixed(3)} ${Math.round(baseH)})`,
        hsl: formatHsl(rgbColor) || '',
        isKeyColor: false,
        isBaseColor: true
      };
    }
    
    // For nearby shades, create a smooth transition
    if (distanceFromBase <= 200) {
      const transitionWeight = Math.max(0, 1 - distanceFromBase / 200);
      const standardL = colorPatterns.lightness[shade];
      
      // Calculate expected lightness difference from standard
      const expectedDiff = standardL - colorPatterns.lightness[baseShade];
      const actualDiff = baseL - colorPatterns.lightness[baseShade];
      
      // Adjust neighboring shades to create a smooth transition
      targetL = standardL + (actualDiff - expectedDiff) * transitionWeight;
    }

    // Calculate target chroma with smooth transition
    let targetC = maxChroma * colorPatterns.chromaRatios[shade];
    
    // For yellows, reduce chroma more aggressively in darker shades to prevent red shift
    if (isYellowish && shade >= 500) {
      const reductionFactor = 1 - ((shade - 500) / 900) * 0.3; // Gradually reduce chroma more
      targetC *= reductionFactor;
    }
    
    if (distanceFromBase <= 200) {
      // Smoothly transition chroma near the base color
      const transitionWeight = Math.max(0, 1 - distanceFromBase / 200);
      const standardC = maxChroma * colorPatterns.chromaRatios[shade];
      const baseRelativeC = Math.min(baseC, chromaCap);
      
      // Blend between standard and base-relative chroma
      targetC = standardC * (1 - transitionWeight) + baseRelativeC * transitionWeight;
    }

    // Ensure we stay in gamut
    const oklchColor = { mode: 'oklch', l: targetL, c: targetC, h: baseH };
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
            isKeyColor: false,
            isBaseColor: false
          };
        }
      }
    }

    const hexColor = formatHex(rgbColor) || '#000000';
    
    return {
      color: hexColor,
      oklch: `oklch(${(targetL * 100).toFixed(1)}% ${targetC.toFixed(3)} ${Math.round(baseH)})`,
      hsl: formatHsl(rgbColor) || '',
      isKeyColor: false,
      isBaseColor: false
    };
  });
}

export default function ColorPalette() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [baseColor, setBaseColor] = useState('#00FF1E');
  const [shadeColors, setShadeColors] = useState<Array<{ color: string; oklch: string; hsl: string; isKeyColor: boolean; isBaseColor: boolean }>>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const updatePalette = useCallback((hex: string) => {
    const { l, c, h, hsl_l } = hexToOKLCH(hex);
    const newShades = generateShades(l, c, h, hsl_l);
    setShadeColors(newShades);
  }, []);

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

  // Get the current base color formats using culori
  const baseColorFormats = (() => {
    const color = oklch(baseColor);
    if (!color || color.l === undefined) return { hex: '', oklch: '', hsl: '' };

    const hslColor = converter('oklch', 'hsl')(color);
    
    return {
      hex: baseColor.toUpperCase(),
      oklch: `oklch(${(color.l * 100).toFixed(0)}% ${(color.c || 0).toFixed(3)} ${Math.round(color.h || 0)})`,
      hsl: formatHsl(hslColor) || ''
    };
  })();

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto">
      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 mb-12">
        {shadeColors.map((colorData, index) => {
          // Get the latest color formats for each shade using culori
          const color = oklch(colorData.color);
          const hslColor = color ? converter('oklch', 'hsl')(color) : null;
          const hslStr = hslColor ? formatHsl(hslColor) : '';
          
          return (
            <div
              key={shades[index]}
              className="bg-card text-card-foreground flex items-center gap-4 p-6 rounded-xl border border-border"
            >
              <div className="relative w-16 h-16">
                <div
                  className="w-full h-full rounded-lg border border-border"
                  style={{ backgroundColor: colorData.color }}
                />
                {colorData.isBaseColor && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-white ring-4 ring-primary" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="text-lg font-medium mb-2 text-foreground flex items-center gap-2">
                  Shade {shades[index]}
                  {colorData.isBaseColor && (
                    <span className="text-xs font-normal text-primary">(Base Color)</span>
                  )}
                </div>
                <div className="font-mono text-xs space-y-1 text-muted-foreground">
                  <div>{colorData.color.toUpperCase()}</div>
                  <div>{colorData.oklch}</div>
                  <div>{hslStr}</div>
                </div>
              </div>
            </div>
          );
        })}
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
                <div>{baseColorFormats.hex}</div>
                <div>{baseColorFormats.oklch}</div>
                <div>{baseColorFormats.hsl}</div>
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