import { defineConfig } from "vitepress";
import { resolve, join } from "path";
import { existsSync, statSync, createReadStream } from "fs";

export default defineConfig({
  title: "cloupe.js",
  description: "JavaScript library for reading .cloupe files in the browser",

  lang: "en-US",
  base: "/",
  outDir: ".vitepress/dist",

  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }]],

  themeConfig: {
    logo: "/logo.svg",

    nav: [
      { text: "Live Demo", link: "/demo/" },
      { text: "Guide", link: "/guide/", activeMatch: "/guide/" },
      { text: "API", link: "/api/", activeMatch: "/api/" },
      { text: "Examples", link: "/examples/", activeMatch: "/examples/" },
      {
        text: "Links",
        items: [
          { text: "GitHub", link: "https://github.com/honeymaro/cloupe.js" },
          { text: "npm", link: "https://www.npmjs.com/package/cloupe.js" },
        ],
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "Overview", link: "/guide/" },
            { text: "Installation", link: "/guide/installation" },
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Browser Support", link: "/guide/browser-support" },
          ],
        },
      ],

      "/api/": [
        {
          text: "API Reference",
          items: [
            { text: "Overview", link: "/api/" },
            { text: "CloupeReader", link: "/api/cloupe-reader" },
            { text: "Types", link: "/api/types" },
          ],
        },
        {
          text: "Specialized Readers",
          items: [
            { text: "BarcodeReader", link: "/api/readers/barcode-reader" },
            { text: "FeatureReader", link: "/api/readers/feature-reader" },
            { text: "ProjectionReader", link: "/api/readers/projection-reader" },
            { text: "CellTrackReader", link: "/api/readers/cell-track-reader" },
            { text: "MatrixReader", link: "/api/readers/matrix-reader" },
            { text: "SpatialImageReader", link: "/api/readers/spatial-image-reader" },
          ],
        },
      ],

      "/examples/": [
        {
          text: "Examples",
          items: [
            { text: "Overview", link: "/examples/" },
            { text: "Basic Usage", link: "/examples/basic-usage" },
            { text: "Web Worker", link: "/examples/web-worker" },
            { text: "Visualization", link: "/examples/visualization" },
          ],
        },
      ],

      "/architecture/": [
        {
          text: "Architecture",
          items: [{ text: "Overview", link: "/architecture/" }],
        },
      ],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/honeymaro/cloupe.js" }],

    footer: {
      message: "Released under the MIT License.",
      copyright: `Copyright © ${new Date().getFullYear()}`,
    },

    search: {
      provider: "local",
    },

    outline: {
      label: "On this page",
      level: [2, 3],
    },

    docFooter: {
      prev: "Previous",
      next: "Next",
    },

    lastUpdated: {
      text: "Last updated",
    },

    editLink: {
      pattern: "https://github.com/honeymaro/cloupe.js/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
  },

  markdown: {
    lineNumbers: true,
  },

  vite: {
    resolve: {
      alias: {
        "cloupe.js": resolve(__dirname, "../../src"),
      },
    },
    server: {
      fs: {
        allow: [resolve(__dirname, "../../")],
      },
    },
    plugins: [
      {
        name: "serve-samples",
        configureServer(server) {
          const fixturesDir = resolve(__dirname, "../../tests/fixtures");

          server.middlewares.use((req: any, res: any, next: any) => {
            const url = req.url || "";

            // Serve fixture files at /samples/
            if (url.startsWith("/samples/")) {
              const filePath = join(fixturesDir, url.replace("/samples/", ""));

              if (existsSync(filePath)) {
                const stat = statSync(filePath);
                res.setHeader("Content-Length", stat.size);
                res.setHeader("Content-Type", "application/octet-stream");
                res.setHeader("Accept-Ranges", "bytes");

                const range = req.headers.range;
                if (range) {
                  const parts = range.replace(/bytes=/, "").split("-");
                  const start = parseInt(parts[0], 10);
                  const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                  res.statusCode = 206;
                  res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
                  res.setHeader("Content-Length", end - start + 1);
                  createReadStream(filePath, { start, end }).pipe(res);
                } else {
                  createReadStream(filePath).pipe(res);
                }
                return;
              }
            }

            next();
          });
        },
      },
    ],
  },
});
