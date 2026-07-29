import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_DATA_PATH = path.join(ROOT_DIR, "data", "github-stars.json");
const DEFAULT_INDEX_PATH = path.join(ROOT_DIR, "index.html");
const START_MARKER = "<!-- github-stars:start -->";
const END_MARKER = "<!-- github-stars:end -->";

export function selectRepositories(repositories) {
  return repositories
    .filter(
      (repository) =>
        repository.private !== true &&
        repository.fork !== true &&
        repository.archived !== true &&
        repository.disabled !== true,
    )
    .map((repository) => ({
      name: repository.name,
      stars: Number(repository.stargazers_count) || 0,
      url: repository.html_url,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function fetchOrganizationRepositories({
  organization,
  token,
  fetchImplementation = fetch,
}) {
  const repositories = [];

  for (let page = 1; page <= 100; page += 1) {
    const url = new URL(`https://api.github.com/orgs/${organization}/repos`);
    url.searchParams.set("type", "public");
    url.searchParams.set("sort", "full_name");
    url.searchParams.set("direction", "asc");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "goptics-star-tracker",
      "X-GitHub-Api-Version": "2026-03-10",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetchImplementation(url, { headers });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `GitHub API request failed (${response.status}): ${body.slice(0, 300)}`,
      );
    }

    const pageRepositories = await response.json();

    if (!Array.isArray(pageRepositories)) {
      throw new TypeError("GitHub API returned a non-array repository response");
    }

    repositories.push(...pageRepositories);

    if (pageRepositories.length < 100) {
      break;
    }
  }

  return repositories;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function dateFromKey(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function dayDifference(laterDateKey, earlierDateKey) {
  return Math.max(
    0,
    Math.round(
      (dateFromKey(laterDateKey) - dateFromKey(earlierDateKey)) /
        (24 * 60 * 60 * 1000),
    ),
  );
}

export function buildStats({
  organization,
  repositories,
  previousStats = {},
  now = new Date(),
}) {
  const date = toDateKey(now);
  const totalStars = repositories.reduce(
    (total, repository) => total + repository.stars,
    0,
  );

  const previousHistory = Array.isArray(previousStats.history)
    ? previousStats.history
    : [];

  const history = previousHistory
    .filter(
      (snapshot) =>
        snapshot &&
        /^\d{4}-\d{2}-\d{2}$/.test(snapshot.date) &&
        Number.isFinite(snapshot.totalStars) &&
        snapshot.date !== date,
    )
    .concat({ date, totalStars })
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-400);

  const target = new Date(`${date}T00:00:00.000Z`);
  target.setUTCDate(target.getUTCDate() - 30);
  const targetDate = toDateKey(target);

  const snapshotAtOrBeforeTarget = history
    .filter((snapshot) => snapshot.date <= targetDate)
    .at(-1);
  const baseline = snapshotAtOrBeforeTarget ?? history[0];
  const trackedDays = dayDifference(date, baseline.date);
  const change = totalStars - baseline.totalStars;

  return {
    organization,
    updatedAt: date,
    trackingSince: history[0].date,
    totalStars,
    repositoryCount: repositories.length,
    change,
    trackedDays,
    repositories,
    history,
  };
}

function pluralize(value, singular, plural = `${singular}s`) {
  return value === 1 ? singular : plural;
}

function formatTrackedChange(stats) {
  if (stats.trackedDays === 0) {
    return `Tracking started ${new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(dateFromKey(stats.trackingSince))}`;
  }

  const sign = stats.change > 0 ? "+" : "";
  const period =
    stats.trackedDays >= 30
      ? "in the last 30 days"
      : `in ${stats.trackedDays} tracked ${pluralize(stats.trackedDays, "day")}`;

  return `${sign}${stats.change.toLocaleString("en-US")} ${pluralize(
    Math.abs(stats.change),
    "star",
  )} ${period}`;
}

export function renderStatsMarkup(stats) {
  const total = stats.totalStars.toLocaleString("en-US");
  const repositories = stats.repositoryCount.toLocaleString("en-US");

  return `${START_MARKER}
            <strong class="github-pulse__total">${total} ${pluralize(
              stats.totalStars,
              "star",
            )}</strong>
            <span>across ${repositories} open-source ${pluralize(
              stats.repositoryCount,
              "project",
            )}</span>
            <span class="github-pulse__change">${formatTrackedChange(stats)}</span>
            ${END_MARKER}`;
}

export function updateIndexHtml(indexHtml, stats) {
  const pattern = new RegExp(
    `${START_MARKER}[\\s\\S]*?${END_MARKER}`,
    "m",
  );

  if (!pattern.test(indexHtml)) {
    throw new Error("GitHub star markers were not found in index.html");
  }

  return indexHtml.replace(pattern, renderStatsMarkup(stats));
}

async function readPreviousStats(dataPath) {
  try {
    return JSON.parse(await readFile(dataPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function main() {
  const organization = process.env.GITHUB_ORG || "goptics";
  const token = process.env.GITHUB_TOKEN;
  const rawRepositories = await fetchOrganizationRepositories({
    organization,
    token,
  });
  const repositories = selectRepositories(rawRepositories);
  const previousStats = await readPreviousStats(DEFAULT_DATA_PATH);
  const stats = buildStats({
    organization,
    repositories,
    previousStats,
  });

  const indexHtml = await readFile(DEFAULT_INDEX_PATH, "utf8");
  const updatedIndexHtml = updateIndexHtml(indexHtml, stats);

  await mkdir(path.dirname(DEFAULT_DATA_PATH), { recursive: true });
  await writeFile(
    DEFAULT_DATA_PATH,
    `${JSON.stringify(stats, null, 2)}\n`,
    "utf8",
  );
  await writeFile(DEFAULT_INDEX_PATH, updatedIndexHtml, "utf8");

  console.log(
    `Updated ${organization}: ${stats.totalStars} stars across ${stats.repositoryCount} projects`,
  );
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
