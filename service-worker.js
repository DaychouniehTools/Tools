const SHELL_CACHE = "daychounieh-shell-v2";
const IMAGE_CACHE = "daychounieh-images-v1";
const SCOPE_URL = new URL(self.registration.scope);
const INDEX_URL = new URL("index.html", SCOPE_URL);
const PRIVATE_CATALOG_URL = new URL("private-catalog.html", SCOPE_URL);
const IMAGE_PATH = new URL("images/", SCOPE_URL).pathname;
const activeImageJobs = new Map();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll([
        INDEX_URL.href,
        PRIVATE_CATALOG_URL.href,
        new URL("private-catalog-config.js", SCOPE_URL).href
      ]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => (name.startsWith("daychounieh-shell-") && name !== SHELL_CACHE)
            || name.startsWith("daychounieh-images-"))
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== SCOPE_URL.origin || !url.pathname.startsWith(SCOPE_URL.pathname)) return;

  if (request.mode === "navigate") {
    const cacheablePage = !url.search && [INDEX_URL.pathname, PRIVATE_CATALOG_URL.pathname].includes(url.pathname);
    if (!cacheablePage) {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          const page = await cache.match(request) || await cache.match(INDEX_URL.href);
          if (page) return page;
          return new Response("The shop is not available offline yet. Connect to the internet and open it once.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        })
    );
    return;
  }

  if (url.pathname.startsWith(IMAGE_PATH)) {
    event.respondWith(networkFirst(request, IMAGE_CACHE));
    return;
  }

});

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || typeof message.jobId !== "string") return;

  if (message.type === "CANCEL_IMAGE_CACHE") {
    const job = activeImageJobs.get(message.jobId);
    if (job) job.cancelled = true;
    return;
  }

  if (message.type === "CACHE_PRODUCT_IMAGES" && Array.isArray(message.urls)) {
    const job = { cancelled: false };
    activeImageJobs.set(message.jobId, job);
    event.waitUntil(cacheProductImages(message, event.source, job).catch((error) => {
      event.source?.postMessage({
        type: "IMAGE_CACHE_DONE",
        jobId: message.jobId,
        completed: 0,
        failed: message.urls.length,
        total: message.urls.length,
        cancelled: true,
        error: error.message || "Could not save product photos for offline use."
      });
    }).finally(() => {
      activeImageJobs.delete(message.jobId);
    }));
  }
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  let response;
  try {
    response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    if (response.ok) return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
  const cached = await cache.match(request);
  return cached || response;
}

async function cacheProductImages(message, client, job) {
  const urls = Array.from(new Set(message.urls.filter((value) => {
    if (typeof value !== "string") return false;
    try {
      const url = new URL(value);
      return url.origin === SCOPE_URL.origin && url.pathname.startsWith(IMAGE_PATH);
    } catch {
      return false;
    }
  })));
  const cache = await caches.open(IMAGE_CACHE);
  let next = 0;
  let completed = 0;
  let failed = 0;

  const reportProgress = () => client?.postMessage({
    type: "IMAGE_CACHE_PROGRESS",
    jobId: message.jobId,
    completed,
    failed,
    total: urls.length
  });
  reportProgress();

  async function saveNext() {
    while (!job.cancelled) {
      const index = next++;
      if (index >= urls.length) return;
      try {
        const request = new Request(urls[index]);
        if (!await cache.match(request)) {
          const response = await fetch(request);
          if (!response.ok || response.type !== "basic") throw new Error(`Photo request failed: ${response.status}`);
          await cache.put(request, response.clone());
        }
      } catch (error) {
        failed += 1;
        console.error("Could not save a product photo for offline use:", urls[index], error);
        if (error.name === "QuotaExceededError") {
          job.cancelled = true;
          job.error = "The browser ran out of storage while saving photos. Free browser storage and retry.";
        }
      } finally {
        completed += 1;
        if (completed % 10 === 0 || completed === urls.length) reportProgress();
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, urls.length) }, () => saveNext()));
  client?.postMessage({
    type: "IMAGE_CACHE_DONE",
    jobId: message.jobId,
    completed,
    failed,
    total: urls.length,
    cancelled: job.cancelled,
    error: job.error || ""
  });
}
