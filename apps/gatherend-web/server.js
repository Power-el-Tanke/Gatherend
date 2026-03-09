import { createServer } from "http";
import { parse } from "url";
import next from "next";

const port = process.env.PORT || 3000;
const dev = false;

const app = next({
  dev,
  dir: "./apps/gatherend-web",
});

const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, () => {
    console.log("Gatherend-Web running on port", port);
  });
});
