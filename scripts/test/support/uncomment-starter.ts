export function uncommentStarter(source: string) {
  return source
    .replace(/^\/\/ import /gm, "import ")
    .replace(/^\/\/ const /gm, "const ")
    .replace(/^([\t ]+)\/\/ const /gm, "$1const ")
    .replace(
      /\/\/ TODO\(3\)[^\n]*\n\/\/[^\n]*\n(?:\/\/ ─+\n)?([\s\S]*?)(?=export default function App)/,
      (_match, code: string) => code.replace(/^\/\/ ?/gm, ""),
    )
    .replace(/^\s*<p>ここに会話が入ります。<\/p>\n/gm, "")
    .replace(/^\s*\{\/\*\s*\n/gm, "")
    .replace(/^\s*\*\/\}\s*\n/gm, "");
}
