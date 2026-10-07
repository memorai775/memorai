// ==============================
// メモライ service worker
// オフラインでも動くように、アプリのファイルを保存しておく
// ==============================

// ファイルを大きく作り直したときは数字を上げる（古い保存分を消すため）
const CACHE_NAME = "memorai-v3";


// 最初に保存しておくファイル
const APP_FILES = [
  "./",
  "./index.html",
  "./app.js",
  "./englishWords.js",
  "./subjectCards.js",
  "./mydecks.js",
  "./firebase-config.js",
  "./community.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];


// インストール時：アプリのファイルをまとめて保存
self.addEventListener("install", event => {

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});


// 有効化時：古いバージョンの保存分を消す
self.addEventListener("activate", event => {

  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});


// 読み込み時：保存してあるものをすぐ返し、裏で最新版を取りに行って保存し直す
// （オフラインでも開ける・GitHub に上げた更新は次に開いたときに反映される）
self.addEventListener("fetch", event => {

  const request = event.request;


  // 自分のサイトの GET だけを扱う
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  ) {

    return;
  }


  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(request, { ignoreSearch: true }).then(cached => {

        const fromNetwork =
          fetch(request)
            .then(response => {

              if (response.ok) {

                cache.put(request, response.clone());
              }

              return response;
            })
            .catch(() => cached);


        return cached || fromNetwork;
      })
    )
  );
});
