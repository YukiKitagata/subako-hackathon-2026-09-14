import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

export type Video = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
};
type SearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: { medium?: { url?: string } };
  };
};
type YouTubeApiOptions = {
  apiKey: string;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
};

const entities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};
// search.list のタイトルはHTMLエスケープされて返るので、表示用の文字に戻します。
function decode(text: string) {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => entities[entity]);
}

function reply(res: ServerResponse, status: number, body: object) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

export function createYouTubeMiddleware({ apiKey, fetch: fetcher = fetch }: YouTubeApiOptions) {
  // search.list は1回100ユニット消費します。同じ種目の再検索ではクォータを使いません。
  const cache = new Map<string, Video[]>();

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? "", "http://localhost");
    if (url.pathname !== "/__youtube/search") return next();
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return reply(res, 405, { error: "GETで呼び出してください。" });
    }
    const q = url.searchParams.get("q")?.trim() ?? "";
    if (!q || q.length > 100)
      return reply(res, 400, { error: "q に1〜100文字の種目名を指定してください。" });
    if (!apiKey.trim())
      return reply(res, 503, { error: "YOUTUBE_API_KEY を設定して、開発サーバーを再起動してください。" });

    const cached = cache.get(q);
    if (cached) return reply(res, 200, { videos: cached });

    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "3",
      q: `${q} やり方 フォーム`,
      regionCode: "JP",
      relevanceLanguage: "ja",
      safeSearch: "strict",
      videoEmbeddable: "true",
      key: apiKey,
    });
    try {
      const response = await fetcher(`https://www.googleapis.com/youtube/v3/search?${params}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`YouTube API ${response.status}`);
      const body = (await response.json()) as { items?: SearchItem[] };
      const videos = (body.items ?? []).flatMap((item): Video[] =>
        item.id?.videoId && item.snippet
          ? [{
              videoId: item.id.videoId,
              title: decode(item.snippet.title ?? ""),
              channelTitle: decode(item.snippet.channelTitle ?? ""),
              thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? "",
            }]
          : [],
      );
      cache.set(q, videos);
      return reply(res, 200, { videos });
    } catch {
      // APIキーや上流の詳細は返しません。
      return reply(res, 502, { error: "YouTubeを検索できませんでした。APIキーの権限とクォータを確認してください。" });
    }
  };
}

/** 開発サーバーとプレビューの両方に、YouTube検索の口を生やします。 */
export function youtubeDevApi(options: YouTubeApiOptions): Plugin {
  const middleware = createYouTubeMiddleware(options);
  return {
    name: "youtube-dev-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
