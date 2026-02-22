# FitHub Graph

A fitness contribution graph for your GitHub profile.

Makes this:

<img src="./assets/fithub-preview.svg" alt="FitHub Graph" />

with this:

```markdown
![Fitness Graph](https://raw.githubusercontent.com/WestonBDev/git-big/main/dist/fithub-light.svg#gh-light-mode-only)
![Fitness Graph](https://raw.githubusercontent.com/WestonBDev/git-big/main/dist/fithub-dark.svg#gh-dark-mode-only)
```

## Setup

1. Fork this repo (or use it as a template)
2. Create a Strava API app at [strava.com/settings/api](https://www.strava.com/settings/api) -- set the callback domain to `localhost`
3. Make sure [GitHub CLI](https://cli.github.com/) is installed and authenticated (`gh auth login`)
4. Run the guided setup:

```bash
npm install
npm run setup
```

The wizard handles OAuth, sets your repo secrets, and optionally kicks off the first graph update. That's it.

5. Add the image to your profile README:

```markdown
![Fitness Graph](https://raw.githubusercontent.com/<your-username>/git-big/main/dist/fithub-light.svg#gh-light-mode-only)
![Fitness Graph](https://raw.githubusercontent.com/<your-username>/git-big/main/dist/fithub-dark.svg#gh-dark-mode-only)
```

## Importing Historical Data

FitHub reads from Strava, so your workout history needs to live there. If you've been tracking with another app, here's how to get that data in.

**Garmin / Wahoo / other device apps** -- Connect directly at [strava.com/settings/apps](https://www.strava.com/settings/apps). Most integrations will backfill at least a portion of your history automatically.

**Apple Health** -- The Apple Health integration only syncs new activities going forward. This repo includes a built-in converter for older workouts:

1. Open the Health app on your iPhone
2. Tap your profile picture, then **Export All Health Data**
3. Unzip the export on your computer
4. Run the converter:

```bash
npx tsx scripts/apple-health-to-tcx.ts ~/Downloads/apple_health_export/export.xml
```

This parses your workouts, skips any that already have GPS route files, and writes TCX files to a `strava-upload-tcx/` folder next to the export. No health data is copied into the repo.

5. Upload the generated TCX files to [strava.com/upload/select](https://www.strava.com/upload/select) (25 at a time)
6. Upload the GPX files from `workout-routes/` for activities with GPS data

**Other platforms** -- If you can export your data as `.fit`, `.tcx`, or `.gpx` files, upload them directly at [strava.com/upload/select](https://www.strava.com/upload/select). For 100+ files, contact [Strava Support](https://support.strava.com) for bulk import help.

Once your history is in Strava, re-run `npm run generate` or trigger the workflow from the Actions tab and the full year will fill in.

## Relative Intensity Scaling

FitHub uses GitHub-style relative intensity levels instead of fixed minute cutoffs.

- Level `0` is always no activity.
- Levels `1` through `4` are derived from your own rolling yearly distribution.
- Outlier days are handled using the same quartile/outlier approach used by `githubchart` and `githubstats`.

## Contributing

If you see anything that can be improved, send in an issue or PR.

To get the code up and running locally:

```bash
npm install
npm run lint
npm run typecheck
npm test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow.

## See Also

- [The GitHub repo](https://github.com/WestonBDev/git-big)
- [Strava API docs](https://developers.strava.com/)
- [SECURITY.md](./.github/SECURITY.md) -- how to report vulnerabilities
- [LICENSE](./LICENSE) -- MIT
