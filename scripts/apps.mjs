export const apps = {
  todo: { port: 5173, title: "TODO・スタート" },
  "todo-integrated": { port: 5174, title: "TODO・Subako連携" },
  map: { port: 5175, title: "Map・スタート" },
  "map-coffee": { port: 5176, title: "渋谷コーヒー巡り" },
  ec: { port: 5177, title: "EC・スタート" },
  "ec-coffee": { port: 5178, title: "コーヒー・バンドル" },
};
export function appConfig(id) {
  if (!Object.hasOwn(apps, id))
    throw new Error(
      `アプリ名を指定してください: ${Object.keys(apps).join(", ")}`,
    );
  return apps[id];
}
export const agentVariable = (id) =>
  `SUBAKO_AGENT_${id.replaceAll("-", "_").toUpperCase()}`;
