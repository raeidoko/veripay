# VeriPay branding

The supplied logo is preserved in `assets/branding/veripay-logo-source.jpeg`.

Assets:
- `public/brand/veripay-logo-4k.png`: 4096 x 4096 square PNG export.
- `public/brand/veripay-logo-4k-uhd.png`: 3840 x 2160 UHD PNG export.
- `public/brand/veripay-logo.png`: 512 x 512 web image used by the application.
- `public/brand/favicon.png`: 64 x 64 browser icon.

The built-in image_gen tool restored the reference and generated a 1672 x 941
image. The 4K deliverables are high-quality bicubic upscaled exports of that
restoration; they are not native 4K detail. The web logo and square export use a
center crop of the restored image. The original source remains unchanged.

Palette:
- Midnight navy: #06245C
- Royal blue: #0066C2 (primary controls, accessible on white)
- Electric blue: #0066DA (logo)
- Cyan: #18CFE8 (highlights)
- Ice blue: #EFFAFF (surfaces)

Tailwind's brand palette and navy-tinted slate neutrals are defined in
src/index.css. Semantic green, amber, and red states are preserved. Product
photographs are unchanged.

Tool mode: built-in image_gen, reference-image edit; no image API CLI fallback.

## Final generation prompt

Use case: precise-object-edit. Edit target: the attached VeriPay logo. Restore and upscale this exact logo into a clean high-resolution 4K brand master, with a 3840 x 2160 pixel landscape canvas. Center the complete original square logo tile on a clean very pale icy-blue background with generous balanced side margins. Preserve the exact shield/checkmark shape, glossy folded blue/cyan material, navy-to-electric-blue wordmark, rounded frosted square tile and cyan edging. Preserve text verbatim: 'VeriPay' and 'VERIFY • CONNECT • PAY'. Do not redesign or invent elements. Remove the thin black source-image border and JPEG noise; make edges and typography crisp. Palette: midnight navy #06245C, royal blue #0066DA, cyan #18CFE8, ice blue #EFFAFF. The logo must remain square and undistorted, fully visible, centered and occupying almost the full canvas height. Return the actual image at 3840x2160 resolution.
