import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { SubakoSessionClient } from "@subako-ai/sdk";
import { SubakoProvider, useSession, useSessionState, useTool, useToolClient } from "@subako-ai/react";
import { SubakoChat } from "@subako-ai/assistant-ui";
import {
  buildMenu,
  categoryLabels,
  describeWorkout,
  formatDuration,
  itemSeconds,
  parseExercises,
  parseMinutes,
  parseWorkout,
  setItemDone,
  standardItem,
  type MenuEntry,
  type Workout,
} from "./model";
import {
  fetchRoute,
  formatDistance,
  ORIGIN,
  searchGyms,
  type GymSearch,
  type Trip,
} from "./gym";
import { GymMap } from "./gym-map";
import { fetchSessionToken, useSessionId } from "./session";
import type { Video } from "../youtube-dev-api";
import data from "./data.json";
import "./style.css";
import "./layout.css";
import "./session.css";

const exercises = parseExercises(data);
const initialWorkout: Workout = { availableMinutes: null, travelSec: 0, items: [] };
const storageKey = "hackathon:workout";

const baseUrl = import.meta.env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai";
const sessionStorageKey = `hackathon:session:todo:${baseUrl}`;
const subako = new SubakoSessionClient({ baseUrl, getToken: fetchSessionToken });

type Summary = ReturnType<typeof describeWorkout>;

function ExerciseVideos({ name }: { name: string }) {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/__youtube/search?q=${encodeURIComponent(name)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "解説動画を取得できませんでした。");
        setVideos(body.videos);
        setSelected(body.videos[0]?.videoId ?? "");
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [name]);

  if (error) return <p role="alert" className="workout-videos-status session-error">{error}</p>;
  if (!videos) return <p className="workout-videos-status">解説動画を検索しています…</p>;
  if (!videos.length) return <p className="workout-videos-status">解説動画が見つかりませんでした。</p>;
  return (
    <div className="workout-videos">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${selected}`}
        title={`${name}の解説動画`}
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
      <ul>
        {videos.map((video) => (
          <li key={video.videoId}>
            <button
              type="button"
              aria-pressed={video.videoId === selected}
              onClick={() => setSelected(video.videoId)}
            >
              <img src={video.thumbnailUrl} alt="" />
              <span>
                {video.title}
                <small>{video.channelTitle}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WorkoutAssistant({ getSummary, setMinutes, setMenu, findGyms, routeToGym, sessionId, creating, error, onNew }: {
  getSummary: () => Summary;
  setMinutes: (minutes: number) => Summary;
  setMenu: (entries: MenuEntry[]) => Summary;
  findGyms: () => Promise<GymSearch>;
  routeToGym: (gymId: string) => Promise<Summary & { gym: Trip["gym"]; oneWaySeconds: number; oneWayDistanceMeters: number }>;
  sessionId: string;
  creating: boolean;
  error: string;
  onNew: () => void;
}) {
  const session = useSession(sessionId);
  const client = useToolClient(session, "workout");
  const state = useSessionState(session);
  const running = state?.isRunning && state.status !== "failed";
  const connecting = !state || state.status === "connecting" || state.status === "reconnecting";

  useTool(client, "list_exercises", {
    description:
      "トレーニング種目のマスターデータを取得する。category が machine / free_weight の筋トレ種目は、標準のセット数、REP数の範囲、インターバル秒、1REPの秒数を持つ。cardio の有酸素種目は、実施時間の目安範囲（minutesMin〜minutesMax分）と強度の目安intensityを持つ。共通して部位、準備秒、metadata（難易度・注意点）と、標準設定（REP数は上限、有酸素は下限の分数）での所要秒数standardSecondsを返す。所要秒数は、筋トレ = 準備秒 + セット数×REP数×1REPの秒数 + (セット数-1)×インターバル秒、有酸素 = 準備秒 + 分数×60。",
    schema: z.object({}).strict(),
    execute: () =>
      JSON.stringify(exercises.map((exercise) => ({
        ...exercise,
        standardSeconds: itemSeconds(exercise, standardItem(exercise)),
      }))),
  });

  useTool(client, "get_workout", {
    description:
      "現在のスキマ時間（分。未設定ならavailableMinutesとremainingSecondsはnull）とメニュー、往復の移動秒数travelSeconds・トレーニング秒数trainingSeconds・合計totalSeconds・残りremainingSeconds、各種目の完了状態を取得する。ユーザーが画面で削除・完了した内容もここで確認する。",
    schema: z.object({}).strict(),
    execute: () => JSON.stringify(getSummary()),
  });

  useTool(client, "set_available_minutes", {
    description: "スキマ時間（分）を設定する。ジムまでの往復も含めた全体の時間。メニューは変更しないので、合計が超えた場合はset_menuで作り直す。",
    schema: z.object({ minutes: z.number().int().min(1).max(180) }).strict(),
    execute: ({ minutes }) => JSON.stringify(setMinutes(minutes)),
  });

  useTool(client, "find_nearby_gyms", {
    description:
      "現在地（デモ用に渋谷道玄坂東急ビル 1Fで固定）の近くのエニタイムフィットネスを、事前に取得したOpenStreetMapのデータ（2026-09-14時点、渋谷駅から半径3km以内）から直線距離の近い順に最大5件返して地図に表示する。徒歩の所要時間は含まないので、行き先を決めたらroute_to_gymを使う。OSMに未登録の店舗や、取得後に開店した店舗は含まれない。",
    schema: z.object({}).strict(),
    execute: async () => JSON.stringify({ origin: ORIGIN, gyms: (await findGyms()).gyms }),
  });

  useTool(client, "route_to_gym", {
    description:
      "find_nearby_gymsで得たidのジムまで、現在地（渋谷道玄坂東急ビル 1F）からの徒歩経路を取得して地図に表示する。片道の徒歩秒数の2倍を往復の移動時間としてスキマ時間に含める。メニューは変更しないので、結果のremainingSecondsが負ならset_menuで作り直す。",
    schema: z.object({ gymId: z.string().max(80).trim().min(1) }).strict(),
    execute: async ({ gymId }) => JSON.stringify(await routeToGym(gymId)),
  });

  useTool(client, "set_menu", {
    description:
      "メニュー全体を置き換えて画面に表示する。フィードバックで一部だけ変える場合も、変えない種目を含めた全体を実施順に渡す。各項目はlist_exercisesのcategoryに合わせ、筋トレ種目（machine / free_weight）は kind: \"strength\" と sets・reps・restSec を、有酸素種目（cardio）は kind: \"cardio\" と minutes を必ず指定する。往復の移動時間とトレーニングの合計がスキマ時間を超えるとエラーになり、画面は変わらない。完了済みの種目は完了状態を引き継ぐ。",
    schema: z.object({
      // 種類ごとに必要な項目だけを持つ形に分け、筋トレと有酸素の指定を取り違えにくくします。
      // discriminatedUnion は JSON Schema の oneOf になり扱えないモデルがあるため、anyOf になる union を使います。
      items: z.array(z.union([
        z.object({
          kind: z.literal("strength"),
          exerciseId: z.string().max(80).trim().min(1),
          sets: z.number().int().min(1).max(6),
          reps: z.number().int().min(1).max(30),
          restSec: z.number().int().min(0).max(300),
        }).strict(),
        z.object({
          kind: z.literal("cardio"),
          exerciseId: z.string().max(80).trim().min(1),
          minutes: z.number().int().min(1).max(60),
        }).strict(),
      ])).min(1).max(20),
    }).strict(),
    execute: ({ items }) => JSON.stringify(setMenu(items)),
  });

  return (
    <div className="session-conversation" aria-busy={creating}>
      <div className="session-toolbar">
        <button
          type="button"
          disabled={creating || running || connecting}
          onClick={onNew}
          title="会話を新しくし、メニューとジムの経路もクリアします。"
        >
          {creating ? "作成中…" : "＋ 新しいセッション"}
        </button>
        {running && <span>応答後、または停止後に切り替えられます。</span>}
        {error && <p className="session-error" role="alert">{error}</p>}
      </div>
      <div className="session-chat" inert={creating}>
        <SubakoChat session={session} />
      </div>
    </div>
  );
}

export default function App() {
  const [initial] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return { workout: saved === null ? initialWorkout : parseWorkout(exercises, JSON.parse(saved)), error: "" };
    } catch {
      return { workout: initialWorkout, error: "保存データを読めなかったため、初期状態を表示しました。" };
    }
  });
  const [workout, setWorkout] = useState(initial.workout);
  const currentWorkout = useRef(workout);
  const [search, setSearch] = useState<GymSearch | null>(null);
  const currentSearch = useRef(search);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState(initial.error);
  const [videoFor, setVideoFor] = useState("");
  const { sessionId, creating, error: sessionError, startNew } = useSessionId(sessionStorageKey);
  const summary = describeWorkout(exercises, workout);

  useEffect(() => {
    try {
      // スキマ時間と移動時間はその場ごとに決まるので、メニューだけを保存します。
      localStorage.setItem(storageKey, JSON.stringify({ items: workout.items }));
    } catch {
      setError("ブラウザーに保存できません。再読み込みすると変更が失われる可能性があります。");
    }
  }, [workout]);

  const lastSessionId = useRef(sessionId);
  useEffect(() => {
    // 「新しいセッション」で会話を作り直せたら、メニューも0から作り直します。
    // 初回の会話作成（前のIDが空）では、保存済みのメニューを残します。
    if (lastSessionId.current && sessionId && lastSessionId.current !== sessionId) {
      currentSearch.current = null;
      setSearch(null);
      setTrip(null);
      setVideoFor("");
      update(initialWorkout);
    }
    lastSessionId.current = sessionId;
  }, [sessionId]);

  function getWorkout() {
    return currentWorkout.current;
  }
  function getSummary() {
    return describeWorkout(exercises, getWorkout());
  }
  function update(next: Workout) {
    // 再描画前の連続操作にも、直前の変更を渡します。
    currentWorkout.current = next;
    setWorkout(next);
    setError("");
  }
  function setMinutes(minutes: number) {
    update({ ...getWorkout(), availableMinutes: parseMinutes(minutes) });
    return getSummary();
  }
  function setMenu(entries: MenuEntry[]) {
    const current = getWorkout();
    update({ ...current, items: buildMenu(exercises, entries, current) });
    return getSummary();
  }
  async function findGyms() {
    const next = { origin: ORIGIN, ...(await searchGyms(ORIGIN)) };
    currentSearch.current = next;
    setSearch(next);
    setTrip(null);
    update({ ...getWorkout(), travelSec: 0 });
    return next;
  }
  async function routeToGym(gymId: string) {
    const found = currentSearch.current;
    const gym = found?.gyms.find((entry) => entry.id === gymId);
    if (!found || !gym)
      throw new Error("近くのジムの検索結果にないidです。先に近くのジムを探し、その結果のidを指定してください。");
    const route = await fetchRoute(found.origin, gym);
    setTrip({ gym, route });
    update({ ...getWorkout(), travelSec: route.seconds * 2 });
    return { gym, oneWaySeconds: route.seconds, oneWayDistanceMeters: route.distanceMeters, ...getSummary() };
  }
  function clearTrip() {
    setTrip(null);
    update({ ...getWorkout(), travelSec: 0 });
  }
  function complete(exerciseId: string, done: boolean) {
    const current = getWorkout();
    update({ ...current, items: setItemDone(current.items, exerciseId, done) });
  }
  function remove(exerciseId: string) {
    const current = getWorkout();
    update({ ...current, items: current.items.filter((item) => item.exerciseId !== exerciseId) });
  }
  return (
    <div className="app-layout has-session">
      <div className="app-panel">
        <div className="app-content">
          <div className="todo-shell">
            <header className="todo-header">
              <a className="todo-brand" href="/">
                subako<span> / hackathon</span>
              </a>
              <span className="todo-badge">
                TODAY’S WORKOUT
              </span>
            </header>
            <div className="todo-layout">
              <main className="todo-main">
                <p className="todo-eyebrow">SPARE MINUTES, STRONGER YOU.</p>
                <h1>
                  スキマ時間で、
                  <br />
                  ちょっと鍛えよう。
                </h1>
                <p className="todo-lead">
                  空いた時間を伝えるだけ。
                  <br />
                  ジムまでの往復も含めて、時間内に終わるメニューを感想を聞きながら調整します。
                </p>
                {search && (
                  <section className="gym-panel" aria-label="ジムまでの経路">
                    <div className="gym-panel-head">
                      <div>
                        <h2>{trip ? trip.gym.name : "近くのエニタイムフィットネス"}</h2>
                        <p>
                          {trip
                            ? `${ORIGIN.name}から徒歩 片道${formatDuration(trip.route.seconds)}（${formatDistance(trip.route.distanceMeters)}）・往復${formatDuration(trip.route.seconds * 2)}`
                            : search.gyms.length
                              ? `${ORIGIN.name}の近くに${search.gyms.length}件の候補があります。`
                              : `${ORIGIN.name}から半径3km以内に見つかりませんでした。`}
                        </p>
                        <p>ジムの候補は2026年9月14日時点のOpenStreetMapのデータです。</p>
                      </div>
                      {trip && (
                        <button type="button" onClick={clearTrip}>
                          経路を解除
                        </button>
                      )}
                    </div>
                    <div className="gym-map">
                      <GymMap search={search} trip={trip} />
                    </div>
                  </section>
                )}
                <section className="todo-board" aria-label="トレーニングメニュー">
                  <div className="todo-board-title">
                    <h2>今日のメニュー</h2>
                    <span>
                      合計 <b>{formatDuration(summary.totalSeconds)}</b>
                      {workout.availableMinutes !== null && ` / ${workout.availableMinutes}分`}
                    </span>
                  </div>
                  {summary.travelSeconds > 0 && (
                    <p className="workout-breakdown">
                      往復の移動 {formatDuration(summary.travelSeconds)} ＋ トレーニング {formatDuration(summary.trainingSeconds)}
                    </p>
                  )}
                  {summary.remainingSeconds !== null && summary.remainingSeconds < 0 && (
                    <p role="alert" className="todo-error">
                      スキマ時間を{formatDuration(-summary.remainingSeconds)}超えています。アシスタントに調整を頼むか、種目を削除してください。
                    </p>
                  )}
                  {error && (
                    <p role="alert" className="todo-error">
                      {error}
                    </p>
                  )}
                  {summary.items.length ? (
                    <ul className="todo-list">
                      {summary.items.map((item) => (
                        <li key={item.exerciseId} className={item.done ? "done" : ""}>
                          <label>
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={(e) =>
                                complete(item.exerciseId, e.target.checked)
                              }
                            />
                            <span>{item.name}</span>
                          </label>
                          <button
                            type="button"
                            className="workout-video-toggle"
                            aria-expanded={videoFor === item.exerciseId}
                            onClick={() => setVideoFor(videoFor === item.exerciseId ? "" : item.exerciseId)}
                          >
                            解説動画
                          </button>
                          <button
                            onClick={() => remove(item.exerciseId)}
                            aria-label={`${item.name}を削除`}
                          >
                            ×
                          </button>
                          <div className="workout-detail">
                            <p className="workout-targets">
                              <span className="workout-muscle">{item.muscle}</span>
                              {item.targets.join("、")}
                              <span className="workout-category">{categoryLabels[item.category]}</span>
                            </p>
                            {item.category === "cardio" ? (
                              <>
                                <dl className="workout-stats">
                                  <div>
                                    <dt>時間</dt>
                                    <dd>
                                      {item.minutes}
                                      <small>分 目安{item.minutesMin}〜{item.minutesMax}分</small>
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>所要時間</dt>
                                    <dd>{formatDuration(item.seconds)}</dd>
                                  </div>
                                  <div className="workout-stat-wide">
                                    <dt>強度</dt>
                                    <dd>{item.intensity}</dd>
                                  </div>
                                </dl>
                                <div className="workout-timeline" aria-hidden="true">
                                  {item.setupSec > 0 && <span className="setup" style={{ flexGrow: item.setupSec }} />}
                                  <span className="set" style={{ flexGrow: item.minutes * 60 }}>
                                    {item.minutes}分
                                  </span>
                                </div>
                                <p className="workout-legend">
                                  {item.setupSec > 0 && <span className="setup">準備 {formatDuration(item.setupSec)}</span>}
                                  <span className="set">有酸素 {item.minutes}分</span>
                                </p>
                              </>
                            ) : (
                              <>
                                <dl className="workout-stats">
                                  <div>
                                    <dt>セット</dt>
                                    <dd>{item.sets}</dd>
                                  </div>
                                  <div>
                                    <dt>レップ</dt>
                                    <dd>
                                      {item.reps}
                                      <small>目安{item.repsMin}〜{item.repsMax}回</small>
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>インターバル</dt>
                                    <dd>
                                      {item.restSec}
                                      <small>秒</small>
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>所要時間</dt>
                                    <dd>{formatDuration(item.seconds)}</dd>
                                  </div>
                                </dl>
                                <div className="workout-timeline" aria-hidden="true">
                                  {item.setupSec > 0 && <span className="setup" style={{ flexGrow: item.setupSec }} />}
                                  {Array.from({ length: item.sets }, (_, set) => [
                                    set > 0 && <span key={`rest-${set}`} className="rest" style={{ flexGrow: item.restSec }} />,
                                    <span key={`set-${set}`} className="set" style={{ flexGrow: item.setSec }}>
                                      {set + 1}
                                    </span>,
                                  ])}
                                </div>
                                <p className="workout-legend">
                                  {item.setupSec > 0 && <span className="setup">準備 {formatDuration(item.setupSec)}</span>}
                                  <span className="set">セット {formatDuration(item.setSec)} × {item.sets}</span>
                                  {item.sets > 1 && (
                                    <span className="rest">インターバル {formatDuration(item.restSec)} × {item.sets - 1}</span>
                                  )}
                                </p>
                              </>
                            )}
                          </div>
                          {videoFor === item.exerciseId && <ExerciseVideos name={item.name} />}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="todo-empty">
                      <div aria-hidden="true">✓</div>
                      <h3>メニューはまだありません</h3>
                      <p>
                        右のアシスタントに「30分空いたので、近くのエニタイムで胸を鍛えたい」のように話しかけると、
                        <br />
                        ジムまでの往復も含めて時間内に終わるメニューを提案します。
                      </p>
                    </div>
                  )}
                </section>
                <p className="todo-caption">SUBAKO HACKATHON · SHIBUYA · 2026.09.14</p>
              </main>
            </div>
          </div>
        </div>
      </div>

      <aside className="session-sidebar" aria-label="筋トレアシスタント">
        <header className="session-header">
          <h2>筋トレアシスタント</h2>
          <p>空き時間や感想を伝えると、ジムまでの経路とメニューを調整します。</p>
        </header>
        <div className="session-content">
          {sessionId ? (
            <SubakoProvider client={subako}>
              <WorkoutAssistant
                key={sessionId}
                getSummary={getSummary}
                setMinutes={setMinutes}
                setMenu={setMenu}
                findGyms={findGyms}
                routeToGym={routeToGym}
                sessionId={sessionId}
                creating={creating}
                error={sessionError}
                onNew={startNew}
              />
            </SubakoProvider>
          ) : (
            <div className="session-toolbar" aria-busy={creating}>
              {creating ? (
                <span>会話を準備しています…</span>
              ) : (
                <button type="button" onClick={startNew}>もう一度試す</button>
              )}
              {sessionError && <p className="session-error" role="alert">{sessionError}</p>}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
