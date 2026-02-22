# FitHub Graph

A fitness contribution graph for your GitHub profile. Green is code. Red is discipline.

Make this:

<img src="./assets/fithub-preview.svg" alt="FitHub Graph" />

with this:

```markdown
![Fitness Graph](https://raw.githubusercontent.com/WestonBDev/git-big/main/dist/fithub-light.svg#gh-light-mode-only)
![Fitness Graph](https://raw.githubusercontent.com/WestonBDev/git-big/main/dist/fithub-dark.svg#gh-dark-mode-only)
```

## Why

GitHub's contribution graph is one of the best data visualizations out there -- a year of work at a glance. FitHub does the same thing for your workouts. It pulls your Strava activity data daily, maps minutes to intensity levels, and renders a red contribution graph SVG that lives right next to your green one.

A GitHub Actions cron runs every day, refreshes your Strava token, and commits the updated graph. Your profile README stays current without you lifting a finger (except at the gym).

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

## Custom Thresholds

By default, daily workout minutes map to intensity levels like this:

| Level | Minutes |
|-------|---------|
| 0     | 0       |
| 1     | 1--19   |
| 2     | 20--39  |
| 3     | 40--59  |
| 4     | 60+     |

You can customize these by setting the `FITHUB_THRESHOLDS` repo variable to four comma-separated ascending integers. For example, `1,30,60,90` would shift the scale for heavier training.

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
