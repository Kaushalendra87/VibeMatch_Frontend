/**
 * The Recharts palette.
 *
 * **Why this is a module and not a hook inside the analytics page.** Chart
 * colours cannot come from Tailwind: Recharts renders raw SVG attributes
 * (`stroke`, `fill`, `stopColor`), which take a colour *value*, not a
 * class name — so `stroke="brand-500"` is not a thing that works, and the
 * CSS cascade never reaches these elements. Every chart in the app
 * therefore has to hold literal values, and the moment two files hold
 * their own literals they disagree.
 *
 * They already did. The analytics page was carrying a hand-written palette
 * whose "brand" series was `#8b5cf6` — a **violet**, in an app whose entire
 * accent identity is a muted rose. Nobody chose that; it was a default
 * that survived a rebrand because nothing connected it to the tokens. The
 * fix is to keep exactly one copy of these values and keep it next to the
 * tokens it mirrors.
 *
 * **These must be kept in step with `tailwind.config.js` by hand.** That
 * is the cost of a value that has to be a string. The values are the
 * 500/600 steps of each family, which are the ones that read at 1–2px
 * stroke widths and as 35%-opacity area fills.
 */

/** The one place these hex values exist. Mirrors `tailwind.config.js`. */
const PALETTE = {
  // brand-500 / brand-600 — the identity colour, and its text-safe step.
  brand: '#b5646e',
  brandStrong: '#9d4e59',
  // sage-500 — the positive series.
  success: '#7d9471',
  // accent-500 — super-likes and any "attention" series.
  warning: '#f59e0b',
  // A slate, because a chart often needs a genuinely neutral series and
  // tinting it would imply a meaning it does not have.
  info: '#64748b',

  // Grid and axis: the neutral ramp, not the accent ramp. A tinted
  // gridline is the classic way a chart starts looking muddy.
  gridLight: '#e8e0da', // sand-200
  gridDark: '#2a2521', // sand-800
  axisLight: '#7d7168', // sand-500
  axisDark: '#a89a90', // sand-400

  // Tooltip surface, matching `.surface-overlay`.
  tooltipBgLight: '#ffffff',
  tooltipBgDark: '#1a1614', // sand-900
  tooltipBorderLight: '#e8e0da', // sand-200
  tooltipBorderDark: '#443d38', // sand-700
  tooltipTextLight: '#0f172a',
  tooltipTextDark: '#e2e8f0',
}

/**
 * Resolve the palette for the current theme.
 *
 * `isDark` is passed in rather than read from `ThemeContext` here so this
 * stays a plain function — the hook that reads context belongs to the
 * component, and keeping the split means a test can call this without a
 * provider.
 */
export function chartTheme(isDark) {
  return {
    grid: isDark ? PALETTE.gridDark : PALETTE.gridLight,
    axis: isDark ? PALETTE.axisDark : PALETTE.axisLight,
    tooltip: {
      backgroundColor: isDark ? PALETTE.tooltipBgDark : PALETTE.tooltipBgLight,
      border: `1px solid ${
        isDark ? PALETTE.tooltipBorderDark : PALETTE.tooltipBorderLight
      }`,
      borderRadius: '0.5rem',
      fontSize: '0.75rem',
      color: isDark ? PALETTE.tooltipTextDark : PALETTE.tooltipTextLight,
    },
    brand: PALETTE.brand,
    brandStrong: PALETTE.brandStrong,
    success: PALETTE.success,
    warning: PALETTE.warning,
    info: PALETTE.info,
  }
}
