# goptics.org

The organization website for [Goptics](https://github.com/goptics): focused,
non-commercial open-source tools built with Go.

## Local preview

The site has no build step. Serve the repository root with any static server:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Structure

- `index.html`: organization landing page
- `styles.css`: layout, tokens, responsive behavior, and motion
- `404.html`: branded not-found page
- `privacy.html`: plain-language privacy notice
- `assets/`: optimized Goptics marks, Open Graph image, and the self-hosted Recursive typeface
- `assets/og-image.png`: social preview image (1200×630)
- `scripts/og-image.html`: source layout used to render the OG image
- `scripts/render-og.mjs`: headless Chrome screenshot → `assets/og-image.png`
- `scripts/update-stars.mjs`: fetches and renders organization star statistics
- `data/github-stars.json`: current totals and a bounded daily history
- `.github/workflows/update-stars.yml`: refreshes the statistics every day

## Open Graph image

The site uses a standard 1200×630 social card at `assets/og-image.png`. It
carries the homepage H1 and the light paper / ink / cyan theme.

To re-render after copy or brand changes (requires Google Chrome or Chromium):

```bash
node scripts/render-og.mjs
```

## GitHub star pulse

The homepage shows the total stars across public repositories owned by Goptics.
Forks, archived repositories, disabled repositories, and private repositories
are excluded.

At `00:23 UTC` each day, the workflow:

1. Runs the updater's Node.js tests.
2. Fetches every public repository through the GitHub REST API.
3. Stores a daily total while retaining the latest 400 snapshots.
4. Calculates growth over up to 30 days.
5. Rewrites the marked static block in `index.html`.
6. Commits the generated JSON and HTML when they change.

The workflow can also be run manually from the Actions tab. It uses the
repository-provided `GITHUB_TOKEN`; no custom secret is required.

## Deployment

This repository is intended to be published as the `goptics.github.io`
organization site on GitHub Pages with `goptics.org` as its custom domain.

The published site is plain HTML and CSS. The Node.js updater runs only in
GitHub Actions, so visitors receive no client-side JavaScript, analytics,
cookies, or third-party asset requests.

## License

The site code is available under the [MIT License](LICENSE). Recursive is
distributed under its own license in `assets/fonts/LICENSE.txt`.
