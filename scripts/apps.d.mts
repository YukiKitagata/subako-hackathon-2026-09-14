export const apps: Record<
  "todo" | "todo-integrated" | "map" | "map-coffee" | "ec" | "ec-coffee",
  { port: number; title: string }
>;
export function appConfig(id: string): { port: number; title: string };
export function sessionVariable(id: string): string;
