/**
 * The design foundation.
 *
 * Everything visual in the app resolves through this file and the
 * component layer in `src/index.css`. The point of keeping it here rather
 * than in ad-hoc utility strings is that a page cannot drift from the
 * system by accident — it can only drift by reaching past these tokens,
 * which is greppable.
 *
 * Three rules govern what is and is not in here:
 *
 * 1. **Colour is semantic, not decorative.** `brand` means "the one thing
 *    to click", `sage` means "this is good news", `accent` means
 *    "super-like". A colour with no meaning does not get a token.
 * 2. **Most surfaces are neutral.** The warm neutrals in `sand` carry the
 *    page and the cards; rose and sage are reserved so that when they
 *    appear they still mean something. An app where everything is tinted
 *    has no way left to signal.
 * 3. **Elevation and motion are tokens too.** Two shadows and one easing,
 *    so nothing decelerates or lifts differently from anything else.
 *
 * Deliberately absent: glow shadows, gradient backgrounds, drifting
 * background meshes, and glassmorphism as a default surface. Those read as
 * template chrome rather than as craft, and they compete with the
 * photography, which is the actual product.
 */

/** @type {import('tailwindcss').Config} */
export default {
  // Class-based rather than media-based so the theme toggle can override
  // the OS setting, and so the choice survives a reload.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /**
         * The single action colour: a **muted rose**.
         *
         * Chosen over a saturated coral because the accent has to survive
         * being next to skin tones in portrait photography all day. A
         * bright coral competes with the faces; a desaturated rose sits
         * beside them. It is also the one colour that can carry a
         * "primary" meaning without reading as a productivity tool — the
         * default indigo every dashboard reaches for does not belong in a
         * product about people.
         *
         * Weight matters here: `500` is the identity colour and is used
         * for borders, dots and fills, while **`600` is the interactive
         * one** — it is the only step dark enough to carry white text at
         * 5.7:1, so buttons and links use it and `500` is never a button
         * background.
         */
        brand: {
          50: '#fbf5f5',
          100: '#f7e8e9',
          200: '#efd3d6',
          300: '#e0b0b5',
          400: '#cd8a92',
          500: '#b5646e',
          600: '#9d4e59',
          700: '#833f49',
          800: '#6d3740',
          900: '#5d3138',
          950: '#33181d',
        },
        /**
         * The positive colour: a **muted sage**.
         *
         * Replaces the emerald the app used to lean on. Emerald next to a
         * warm neutral is the one combination that looks like a bug — a
         * cool, high-chroma green on a warm ground reads as a rendering
         * mistake rather than as a choice. Sage carries a few degrees of
         * yellow so it belongs to the same family as the rose and the
         * neutrals.
         *
         * Its meanings are fixed and few: online, verified, saved,
         * completed, healthy. It is never used for emphasis.
         *
         * `600` and darker are the text-safe steps (5.2:1 and better on
         * white); `400`/`500` are for dots, rings and fills where the
         * colour carries no words.
         */
        sage: {
          50: '#f4f6f1',
          100: '#e6ebe0',
          200: '#ced8c4',
          300: '#adbf9e',
          400: '#8ba377',
          500: '#7d9471',
          600: '#5f7355',
          700: '#4b5b45',
          800: '#3e4a39',
          900: '#353e32',
          950: '#1a2018',
        },
        /**
         * The warm neutral the whole app sits on.
         *
         * A pure grey next to a rose accent looks cold and slightly
         * dirty — the eye reads the clash as a mistake. These carry a few
         * degrees of red so the surfaces feel like the same family as the
         * accent. Used for page background and card surfaces, not for
         * text; body copy keeps Tailwind's slate, which is neutral enough
         * to stay readable on a tinted ground.
         */
        sand: {
          50: '#faf7f5',
          100: '#f4efeb',
          200: '#e8e0da',
          300: '#d5c9c0',
          400: '#a89a90',
          500: '#7d7168',
          600: '#5c534c',
          700: '#443d38',
          800: '#2a2521',
          900: '#1a1614',
          950: '#0e0c0b',
        },
        /**
         * The super-like highlight.
         *
         * The one place a second saturated colour is allowed, because a
         * super-like is a genuinely different act from a like and has to
         * be distinguishable at a glance. Kept to three steps so it cannot
         * quietly grow into a second brand.
         */
        accent: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },

      /**
       * Two families, two jobs.
       *
       * `display` is a soft serif used for a small number of user-facing
       * headings — the wordmark, page titles, and the name on a match.
       * It is what stops the product reading as a dashboard. `sans` is
       * the workhorse: body copy, controls, tables, and **the whole admin
       * console**, which stays sans because a moderator scanning a
       * verification queue needs neutrality, not editorial voice.
       *
       * Both are loaded from the Google Fonts CDN by a single `<link>` in
       * `index.html`; see the comment there. Nothing is bundled, so
       * swapping to self-hosted files is a change to that one tag plus
       * these two stacks — no component references a font by name.
       */
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'Cambria', 'serif'],
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },

      /**
       * The type scale, named by role.
       *
       * The app had four different treatments for a page title and three
       * for a section heading, which is what happens when sizes are picked
       * per page instead of per role. These names are the roles; the sizes
       * behind them are the only ones a heading should use.
       *
       * `2xs` exists because four separate count badges had each
       * independently landed on `text-[10px]`.
       */
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        // Over-photo titles: tight leading, because a name sitting on a
        // portrait should hug its own baseline.
        display: ['1.75rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-lg': ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
      },

      /**
       * Content widths.
       *
       * Named by what the page *is* rather than by a number, because the
       * dashboard had drifted to five different widths with no rule
       * connecting width to content. The rule now: a form is `form`, a
       * reading column is `narrow`, a card grid is `content`, and only a
       * page that is genuinely a wall of cards goes wider.
       *
       * **Nothing here may shadow a Tailwind default.** `full`, `screen-*`
       * and `xs`–`7xl` all already exist and mean specific things —
       * overriding `full` would silently turn every `max-w-full` in the
       * app from "100%" into a fixed width. The steps below are new names
       * only; the widest page uses the stock `7xl` (80rem) rather than a
       * token of its own.
       */
      maxWidth: {
        form: '28rem', // auth: one column, one decision
        narrow: '48rem', // settings, safety, subscription: reading width
        content: '56rem', // matches, a single profile
        wide: '72rem', // overview, likes: card grids
        admin: '100rem', // admin tables are dense; give them the room
      },

      /**
       * Spacing, named where a number would be ambiguous.
       *
       * `card` is the interior padding of a surface. It is a token because
       * the admin console had settled on `p-4` while the dashboard used
       * `p-5` — a one-step difference nobody chose, which made the two
       * halves of the same product feel like different products.
       */
      spacing: {
        card: '1.25rem',
        'card-sm': '1rem',
      },

      boxShadow: {
        // Tuned rather than Tailwind's defaults: the stock shadows are
        // neutral black, which greys out a warm surface. These are tinted
        // with the neutral's own hue at very low alpha so elevation reads
        // as warmth rather than as soot.
        soft: '0 1px 2px rgba(68, 15, 10, 0.04), 0 2px 8px rgba(68, 15, 10, 0.04)',
        lift: '0 10px 30px -12px rgba(68, 15, 10, 0.18), 0 4px 12px -6px rgba(68, 15, 10, 0.10)',
        // For panels that float over content — menus, popovers, modals.
        // The ring is what separates the panel from a same-value surface
        // behind it; a shadow alone cannot do that in dark mode.
        overlay:
          '0 0 0 1px rgba(68, 15, 10, 0.06), 0 16px 48px -16px rgba(68, 15, 10, 0.28)',
      },

      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // A longer, softer entrance for cards resolving into the grid.
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-dot': {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.5' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        // The heart's beat on a like. Deliberately short: this fires on
        // every like, and anything longer stops being a flourish and
        // becomes a delay.
        'heart-pop': {
          '0%': { transform: 'scale(1)' },
          '35%': { transform: 'scale(1.35)' },
          '70%': { transform: 'scale(0.92)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'bounce-dot': 'bounce-dot 1.4s infinite ease-in-out both',
        'heart-pop': 'heart-pop 0.4s ease-out',
      },

      /**
       * One easing and three durations for every deliberate movement.
       *
       * A single curve is what makes a UI feel authored: if the drawer
       * eases out and the modal eases in differently, the app reads as
       * assembled rather than designed.
       */
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        fast: '150ms', // colour and border changes on hover
        base: '250ms', // movement: a card lifting, a panel opening
        slow: '500ms', // continuous fills — progress bars, a photo easing in
      },
    },
  },
  plugins: [],
}
