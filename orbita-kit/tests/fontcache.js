// Подстановка шрифтов Google Fonts из локального кэша в тестах (сеть среды нестабильна).
// Страница по-прежнему ссылается на Google Fonts; кэш влияет только на снимки.
const fs = require("fs"), path = require("path");
const DIR = process.env.FONT_CACHE || "/tmp/claude-0/-home-user-quantum-sensor-scheduler/4745f20a-163f-5a6d-b475-943f641a365a/scratchpad/fonts";
module.exports = async function useFontCache(ctx) {
  if (!fs.existsSync(path.join(DIR, "map.txt"))) return false;
  const map = Object.fromEntries(fs.readFileSync(path.join(DIR, "map.txt"), "utf8").trim().split("\n").map((l) => l.split(" ")));
  await ctx.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, contentType: "text/css", body: fs.readFileSync(path.join(DIR, "css.css")) }));
  await ctx.route("https://fonts.gstatic.com/**", (r) => {
    const f = map[r.request().url()];
    return f ? r.fulfill({ status: 200, contentType: "font/woff2", body: fs.readFileSync(path.join(DIR, f)) }) : r.abort();
  });
  return true;
};
