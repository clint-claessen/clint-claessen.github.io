/* TaDa design tokens ("Academic Data Precision", from the Stitch design system).
   Loaded right after the Tailwind Play CDN script on every page. */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "on-surface": "#0b1c30", "surface": "#f8f9ff", "primary": "#0050a7", "surface-variant": "#d3e4fe", "background": "#f8f9ff",
        "on-secondary-fixed": "#001e2c", "surface-container-lowest": "#ffffff", "on-tertiary-fixed": "#131b2e", "surface-tint": "#005bbe",
        "outline-variant": "#c2c6d5", "secondary-fixed-dim": "#7bd0ff", "tertiary-container": "#626a81", "primary-container": "#0167d4",
        "tertiary": "#4a5268", "on-error": "#ffffff", "surface-dim": "#cbdbf5", "surface-bright": "#f8f9ff", "surface-container": "#e5eeff",
        "on-primary-fixed": "#001a40", "error": "#ba1a1a", "secondary-fixed": "#c4e7ff", "on-primary": "#ffffff", "on-tertiary-container": "#e7ebff",
        "on-tertiary": "#ffffff", "on-secondary-container": "#004d6a", "on-surface-variant": "#424753", "surface-container-highest": "#d3e4fe",
        "tertiary-fixed": "#dae2fd", "on-secondary": "#ffffff", "on-tertiary-fixed-variant": "#3f465c", "on-primary-container": "#e5ebff",
        "tertiary-fixed-dim": "#bec6e0", "inverse-primary": "#acc7ff", "inverse-surface": "#213145", "primary-fixed-dim": "#acc7ff",
        "primary-fixed": "#d7e2ff", "error-container": "#ffdad6", "on-background": "#0b1c30", "on-secondary-fixed-variant": "#004c69",
        "on-primary-fixed-variant": "#004491", "surface-container-high": "#dce9ff", "inverse-on-surface": "#eaf1ff", "secondary": "#00668a",
        "outline": "#727785", "secondary-container": "#40c2fd", "on-error-container": "#93000a", "surface-container-low": "#eff4ff",
        /* semantic status palette from DESIGN.md */
        "ok-bg": "#ecfdf5", "ok-line": "#a7f3d0", "ok-ink": "#047857",
        "amber-bg": "#fffbeb", "amber-line": "#fde68a", "amber-ink": "#b45309",
        "sky-bg": "#f0f9ff", "sky-line": "#bae6fd", "sky-ink": "#0369a1",
        "slate-bg": "#f1f5f9", "slate-line": "#cbd5e1", "slate-ink": "#475569",
        "rose-bg": "#fff1f2", "rose-line": "#fecdd3", "rose-ink": "#be123c"
      },
      borderRadius: { "DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem", "pill": "9999px", "circle": "9999px" },
      spacing: { "space-xl": "2rem", "space-lg": "1.25rem", "margin-mobile": "1rem", "margin": "2rem", "space-sm": "0.5rem", "space-md": "0.75rem", "margin-tablet": "1.25rem", "gutter-tablet": "0.75rem", "gutter-mobile": "0.5rem", "gutter": "1rem", "space-xs": "0.25rem" },
      fontFamily: {
        "code-md": ["JetBrains Mono", "ui-monospace", "Menlo", "monospace"], "code-sm": ["JetBrains Mono", "ui-monospace", "Menlo", "monospace"], "code-lg": ["JetBrains Mono", "ui-monospace", "Menlo", "monospace"],
        "headline-xl": ["Inter", "system-ui", "sans-serif"], "headline-md": ["Inter", "system-ui", "sans-serif"], "headline-lg": ["Inter", "system-ui", "sans-serif"], "headline-xl-mobile": ["Inter", "system-ui", "sans-serif"], "headline-lg-mobile": ["Inter", "system-ui", "sans-serif"],
        "body-lg": ["Inter", "system-ui", "sans-serif"], "body-md": ["Inter", "system-ui", "sans-serif"], "headline-sm": ["Inter", "system-ui", "sans-serif"], "label-sm": ["Inter", "system-ui", "sans-serif"], "body-sm": ["Inter", "system-ui", "sans-serif"], "label-md": ["Inter", "system-ui", "sans-serif"],
        "sans": ["Inter", "system-ui", "sans-serif"], "mono": ["JetBrains Mono", "ui-monospace", "Menlo", "monospace"]
      },
      fontSize: {
        "code-md": ["12px", { lineHeight: "16px", letterSpacing: "0em", fontWeight: "500" }],
        "headline-xl": ["36px", { lineHeight: "44px", letterSpacing: "-0.025em", fontWeight: "700" }],
        "headline-md": ["20px", { lineHeight: "28px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "headline-lg": ["28px", { lineHeight: "36px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-xl-mobile": ["28px", { lineHeight: "36px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg-mobile": ["22px", { lineHeight: "30px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "26px", letterSpacing: "-0.005em", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "22px", letterSpacing: "0em", fontWeight: "400" }],
        "headline-sm": ["16px", { lineHeight: "24px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "code-sm": ["10px", { lineHeight: "14px", letterSpacing: "0.04em", fontWeight: "600" }],
        "label-sm": ["11px", { lineHeight: "16px", letterSpacing: "0.02em", fontWeight: "500" }],
        "body-sm": ["12px", { lineHeight: "18px", letterSpacing: "0.005em", fontWeight: "400" }],
        "code-lg": ["14px", { lineHeight: "20px", letterSpacing: "-0.01em", fontWeight: "500" }],
        "label-md": ["13px", { lineHeight: "18px", letterSpacing: "0.01em", fontWeight: "500" }]
      }
    }
  }
};
