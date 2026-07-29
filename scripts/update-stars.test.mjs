import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStats,
  renderStatsMarkup,
  selectRepositories,
  updateIndexHtml,
} from "./update-stars.mjs";

test("selectRepositories excludes forks, archived repositories, and disabled repositories", () => {
  const repositories = selectRepositories([
    {
      name: "vizb",
      stargazers_count: 78,
      html_url: "https://github.com/goptics/vizb",
      private: false,
      fork: false,
      archived: false,
      disabled: false,
    },
    {
      name: "fork",
      stargazers_count: 900,
      private: false,
      fork: true,
      archived: false,
      disabled: false,
    },
    {
      name: "archive",
      stargazers_count: 500,
      private: false,
      fork: false,
      archived: true,
      disabled: false,
    },
  ]);

  assert.deepEqual(repositories, [
    {
      name: "vizb",
      stars: 78,
      url: "https://github.com/goptics/vizb",
    },
  ]);
});

test("buildStats calculates the total and 30-day growth", () => {
  const stats = buildStats({
    organization: "goptics",
    repositories: [
      { name: "varmq", stars: 192, url: "https://github.com/goptics/varmq" },
      { name: "vizb", stars: 78, url: "https://github.com/goptics/vizb" },
    ],
    previousStats: {
      history: [{ date: "2026-06-29", totalStars: 261 }],
    },
    now: new Date("2026-07-29T12:00:00.000Z"),
  });

  assert.equal(stats.totalStars, 270);
  assert.equal(stats.repositoryCount, 2);
  assert.equal(stats.change, 9);
  assert.equal(stats.trackedDays, 30);
  assert.deepEqual(stats.history, [
    { date: "2026-06-29", totalStars: 261 },
    { date: "2026-07-29", totalStars: 270 },
  ]);
});

test("buildStats replaces a same-day snapshot instead of duplicating it", () => {
  const stats = buildStats({
    organization: "goptics",
    repositories: [
      { name: "vizb", stars: 80, url: "https://github.com/goptics/vizb" },
    ],
    previousStats: {
      history: [{ date: "2026-07-29", totalStars: 78 }],
    },
    now: new Date("2026-07-29T18:00:00.000Z"),
  });

  assert.deepEqual(stats.history, [{ date: "2026-07-29", totalStars: 80 }]);
});

test("renderStatsMarkup produces human-readable static content", () => {
  const markup = renderStatsMarkup({
    totalStars: 320,
    repositoryCount: 6,
    change: 12,
    trackedDays: 30,
    trackingSince: "2026-06-29",
  });

  assert.match(markup, />320 stars</);
  assert.match(markup, /across 6 open-source projects/);
  assert.match(markup, /\+12 stars in the last 30 days/);
});

test("updateIndexHtml replaces only the generated marker block", () => {
  const input = `<p>Before</p>
<!-- github-stars:start -->
old
<!-- github-stars:end -->
<p>After</p>`;

  const output = updateIndexHtml(input, {
    totalStars: 320,
    repositoryCount: 6,
    change: 0,
    trackedDays: 0,
    trackingSince: "2026-07-29",
  });

  assert.match(output, /<p>Before<\/p>/);
  assert.match(output, />320 stars</);
  assert.match(output, /Tracking started Jul 29, 2026/);
  assert.match(output, /<p>After<\/p>/);
});
