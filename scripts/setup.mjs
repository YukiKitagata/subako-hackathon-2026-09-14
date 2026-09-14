import { copyFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
try {
  await copyFile(
    new URL(".env.local.example", root),
    new URL(".env.local", root),
    constants.COPYFILE_EXCL,
  );
  console.log(
    ".env.local を作成しました。CLI登録後、APIキーを入力してください。",
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(".env.local は作成済みです。設定を保持しました。");
}
console.log(`設定ファイル: ${fileURLToPath(new URL(".env.local", root))}`);
console.log("起動: npm run dev -- todo");
