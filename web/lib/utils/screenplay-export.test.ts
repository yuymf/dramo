import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SCRIPT_EXPORT_KINDS,
  buildScreenplayDocx,
  buildScreenplayPdf,
  formatScreenplayTxt,
  layoutScreenplay,
} from "./screenplay-export";
import type { ScreenplayDoc } from "../types/screenplay";

function sample(format: ScreenplayDoc["format"]): ScreenplayDoc {
  return {
    id: "sp-1",
    episodeId: "ep-1",
    title: "咖啡馆",
    format,
    cover: {
      title: "咖啡馆",
      author: "Lee",
      contact: "lee@example.com",
      draftDate: "2026-08-30",
    },
    nodes: [
      { id: "n1", type: "scene_heading", text: "INT. 咖啡馆 - DAY" },
      { id: "n2", type: "action", text: "JOHN sits by the window." },
      { id: "n3", type: "character", text: "John" },
      { id: "n4", type: "parenthetical", text: "soft" },
      { id: "n5", type: "dialogue", text: "Hello there." },
      { id: "n6", type: "comment", text: "do not export this note" },
      { id: "n7", type: "transition", text: "Cut to:" },
      { id: "n8", type: "scene_heading", text: "内景 街道 - 夜" },
      { id: "n9", type: "character", text: "玛丽" },
      { id: "n10", type: "dialogue", text: "我们走吧。" },
    ],
    updatedAt: "2026-08-30T00:00:00.000Z",
  };
}

const hollywood = formatScreenplayTxt(sample("hollywood"));
assert.match(hollywood, /2026-08-30\n\nINT\. 咖啡馆 - DAY/);
assert.match(hollywood, /INT\. 咖啡馆 - DAY/);
assert.match(hollywood, /^ {22}JOHN$/m);
assert.match(hollywood, /^ {10}Hello there\.$/m);
assert.match(hollywood, /^ {16}\(soft\)$/m);
assert.match(hollywood, /CUT TO:/);
assert.doesNotMatch(hollywood, /do not export this note/);
assert.ok(hollywood.indexOf("JOHN") < hollywood.indexOf("Hello there."));
assert.ok(!hollywood.includes("<p>") && !hollywood.includes("scenes"));

const johnLine = hollywood.split("\n").find((line) => line.trim() === "JOHN");
assert.ok(johnLine);
assert.ok(johnLine.startsWith(" ") || johnLine === "JOHN");
const helloLine = hollywood.split("\n").find((line) => line.includes("Hello there."));
assert.ok(helloLine && helloLine.startsWith("          "));

const asian = formatScreenplayTxt(sample("asian"));
assert.match(asian, /INT\. 咖啡馆 - DAY/);
assert.doesNotMatch(asian, /do not export this note/);
const asianAction = asian.split("\n").find((line) => line.includes("JOHN sits"));
assert.ok(asianAction && asianAction.startsWith("　　"));
const asianChar = asian.split("\n").find((line) => line.includes("玛丽"));
assert.ok(asianChar && asianChar.startsWith("　　　　"));
const asianDialogue = asian.split("\n").find((line) => line.includes("我们走吧"));
assert.ok(asianDialogue && asianDialogue.startsWith("　　　　"));

const laid = layoutScreenplay(sample("hollywood"));
assert.equal(
  laid.some((line) => line.kind === "comment"),
  false
);
assert.equal(
  laid.filter((line) => line.kind === "character").every((line) => line.text === line.text.toUpperCase() || /[\u4e00-\u9fff]/.test(line.text)),
  true
);

assert.deepEqual(SCRIPT_EXPORT_KINDS, ["txt", "pdf", "docx"]);
assert.equal(SCRIPT_EXPORT_KINDS.includes("txt" as never), true);

const slotSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../components/screenplay/ExportSlot.tsx"),
  "utf8"
);
assert.doesNotMatch(slotSource, /Fountain|SRT|提词器|teleprompter/i);
assert.match(slotSource, /TXT/);
assert.match(slotSource, /PDF/);
assert.match(slotSource, /DOCX/);

async function testBinaries() {
  const pdfBlob = await buildScreenplayPdf(sample("hollywood"));
  const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
  assert.ok(pdfBlob.size > 100);
  assert.equal(String.fromCharCode(pdfBytes[0], pdfBytes[1], pdfBytes[2], pdfBytes[3]), "%PDF");

  const asianPdf = await buildScreenplayPdf(sample("asian"));
  assert.ok(asianPdf.size > 100);

  const docxBlob = await buildScreenplayDocx(sample("hollywood"));
  const docxBytes = new Uint8Array(await docxBlob.arrayBuffer());
  assert.ok(docxBlob.size > 100);
  assert.equal(docxBytes[0], 0x50);
  assert.equal(docxBytes[1], 0x4b);

  const asianDocx = await buildScreenplayDocx(sample("asian"));
  assert.ok(asianDocx.size > 100);
}

testBinaries()
  .then(() => {
    console.log("screenplay-export tests passed");
    console.log("hollywood txt:\n" + hollywood);
    console.log("asian txt:\n" + asian);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
