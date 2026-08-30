import type {
  Cover,
  NodeType,
  ScreenplayDoc,
  ScreenplayFormat,
  ScreenplayNode,
} from "@/lib/types/screenplay";

/** Script 主导出只开放这三种。口播的 SRT / 提词器不进剧本页。 */
export const SCRIPT_EXPORT_KINDS = ["txt", "pdf", "docx"] as const;
export type ScriptExportKind = (typeof SCRIPT_EXPORT_KINDS)[number];

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const DIALOGUE_GROUP = new Set<NodeType>(["character", "parenthetical", "dialogue"]);
const SKIP_TYPES = new Set<NodeType>(["comment"]);

const HOLLYWOOD_CH = {
  scene_heading: { indent: 0, width: 60 },
  action: { indent: 0, width: 60 },
  character: { indent: 22, width: 28 },
  dialogue: { indent: 10, width: 35 },
  parenthetical: { indent: 16, width: 25 },
  transition: { indent: 40, width: 20 },
  subtitle: { indent: 10, width: 40 },
  comment: { indent: 0, width: 60 },
} as const;

/** 亚洲：缩进以全角字宽计，对齐中文剧本常见排版。 */
const ASIAN_EM = {
  scene_heading: { indent: 0, width: 36 },
  action: { indent: 2, width: 34 },
  character: { indent: 4, width: 28 },
  dialogue: { indent: 4, width: 28 },
  parenthetical: { indent: 6, width: 24 },
  transition: { indent: 0, width: 36 },
  subtitle: { indent: 4, width: 28 },
  comment: { indent: 0, width: 36 },
} as const;

export type LaidKind = NodeType | "cover_title" | "cover_meta" | "blank";

export interface LaidLine {
  kind: LaidKind;
  text: string;
  indent: number;
  width: number;
  align: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
  pageBreakBefore?: boolean;
}

export function displayTitle(doc: ScreenplayDoc): string {
  return (doc.cover.title || doc.title || "untitled").trim() || "untitled";
}

export function safeFilename(doc: ScreenplayDoc): string {
  const raw = displayTitle(doc).replace(/[\\/:*?"<>|]+/g, " ").trim();
  return raw.slice(0, 80) || "screenplay";
}

function hasCjk(text: string): boolean {
  return CJK_RE.test(text);
}

function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    width += CJK_RE.test(ch) || ch === "　" ? 2 : 1;
  }
  return width;
}

function wrapLine(text: string, maxWidth: number): string[] {
  const source = text.replace(/\r\n/g, "\n");
  const paragraphs = source.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    if (displayWidth(paragraph) <= maxWidth) {
      lines.push(paragraph);
      continue;
    }

    const tokens = paragraph.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]|[^\s\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+|\s+/g) ?? [
      paragraph,
    ];
    let current = "";
    for (const token of tokens) {
      if (!current) {
        current = token.trimStart() ? token : "";
        continue;
      }
      if (displayWidth(current + token) <= maxWidth) {
        current += token;
        continue;
      }
      if (token.trim() === "") {
        lines.push(current.trimEnd());
        current = "";
        continue;
      }
      if (displayWidth(token) > maxWidth) {
        if (current) lines.push(current.trimEnd());
        let chunk = "";
        for (const ch of token) {
          if (chunk && displayWidth(chunk + ch) > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        current = chunk;
      } else {
        lines.push(current.trimEnd());
        current = token.trimStart();
      }
    }
    if (current) lines.push(current.trimEnd());
  }

  return lines.length > 0 ? lines : [""];
}

function nodeText(node: ScreenplayNode): string {
  return (node.text ?? "").replace(/\u0000/g, "").trim();
}

function formatParenthetical(text: string, format: ScreenplayFormat): string {
  if ((text.startsWith("(") && text.endsWith(")")) || (text.startsWith("（") && text.endsWith("）"))) {
    return text;
  }
  return format === "asian" ? `（${text}）` : `(${text})`;
}

function formatSceneHeading(text: string, format: ScreenplayFormat): string {
  return format === "hollywood" ? text.toUpperCase() : text;
}

function formatCharacter(text: string, format: ScreenplayFormat): string {
  return format === "hollywood" ? text.toUpperCase() : text;
}

function formatTransition(text: string, format: ScreenplayFormat): string {
  return format === "hollywood" ? text.toUpperCase() : text;
}

function specFor(type: NodeType, format: ScreenplayFormat) {
  return format === "asian" ? ASIAN_EM[type] : HOLLYWOOD_CH[type];
}

function alignFor(type: NodeType): LaidLine["align"] {
  if (type === "transition") return "right";
  if (type === "subtitle") return "center";
  return "left";
}

function needsBlankBefore(prev: NodeType | null, next: NodeType): boolean {
  if (!prev) return false;
  if (DIALOGUE_GROUP.has(prev) && (next === "parenthetical" || next === "dialogue")) return false;
  if (next === "scene_heading" || next === "transition") return true;
  if (DIALOGUE_GROUP.has(prev) && !DIALOGUE_GROUP.has(next)) return true;
  if (!DIALOGUE_GROUP.has(prev) && next === "character") return true;
  if (prev === "character" && next === "character") return true;
  if (next === "subtitle" || prev === "subtitle") return true;
  return false;
}

function coverHasContent(cover: Cover): boolean {
  return Boolean(cover.title || cover.author || cover.contact || cover.draftDate);
}

function layoutCover(doc: ScreenplayDoc): LaidLine[] {
  const cover = doc.cover;
  if (!coverHasContent(cover) && !doc.title.trim()) return [];

  const title = displayTitle(doc);
  const lines: LaidLine[] = [];
  const bodyWidth = doc.format === "asian" ? 36 : 60;

  lines.push({
    kind: "cover_title",
    text: doc.format === "hollywood" ? title.toUpperCase() : title,
    indent: 0,
    width: bodyWidth,
    align: "center",
    bold: true,
  });

  if (cover.author) {
    lines.push({ kind: "blank", text: "", indent: 0, width: bodyWidth, align: "left" });
    if (doc.format === "hollywood") {
      lines.push({
        kind: "cover_meta",
        text: "Written by",
        indent: 0,
        width: bodyWidth,
        align: "center",
      });
    }
    lines.push({
      kind: "cover_meta",
      text: doc.format === "asian" ? `编剧　${cover.author}` : cover.author,
      indent: 0,
      width: bodyWidth,
      align: "center",
    });
  }
  if (cover.contact) {
    lines.push({
      kind: "cover_meta",
      text: doc.format === "asian" ? `联系　${cover.contact}` : cover.contact,
      indent: 0,
      width: bodyWidth,
      align: "center",
    });
  }
  if (cover.draftDate) {
    lines.push({
      kind: "cover_meta",
      text: doc.format === "asian" ? `日期　${cover.draftDate}` : cover.draftDate,
      indent: 0,
      width: bodyWidth,
      align: "center",
    });
  }

  return lines;
}

export function layoutScreenplay(doc: ScreenplayDoc): LaidLine[] {
  const format = doc.format === "asian" ? "asian" : "hollywood";
  const lines: LaidLine[] = [];
  const cover = layoutCover(doc);
  if (cover.length > 0) {
    lines.push(...cover);
  }

  let prev: NodeType | null = null;
  let firstBody = true;

  for (const node of doc.nodes ?? []) {
    if (SKIP_TYPES.has(node.type)) continue;
    let text = nodeText(node);
    if (!text) continue;

    if (node.type === "parenthetical") text = formatParenthetical(text, format);
    if (node.type === "scene_heading") text = formatSceneHeading(text, format);
    if (node.type === "character") text = formatCharacter(text, format);
    if (node.type === "transition") text = formatTransition(text, format);

    const spec = specFor(node.type, format);
    const align = alignFor(node.type);
    const wrapped = wrapLine(text, spec.width);
    const pageBreakBefore = firstBody && cover.length > 0;
    const blank = needsBlankBefore(prev, node.type);

    if (blank || pageBreakBefore) {
      lines.push({ kind: "blank", text: "", indent: 0, width: spec.width, align: "left" });
    }

    wrapped.forEach((piece, index) => {
      lines.push({
        kind: node.type,
        text: piece,
        indent: spec.indent,
        width: spec.width,
        align,
        bold: node.type === "scene_heading",
        italic: node.type === "parenthetical",
        pageBreakBefore: pageBreakBefore && index === 0,
      });
    });

    prev = node.type;
    firstBody = false;
  }

  return lines;
}

function padPlain(line: LaidLine, fullwidth: boolean): string {
  if (line.kind === "blank" || !line.text) return "";
  const space = fullwidth ? "　" : " ";
  const unit = fullwidth ? 2 : 1;
  const indent = space.repeat(line.indent);
  const textWidth = displayWidth(line.text);
  const box = line.indent * unit + line.width;

  if (line.align === "right") {
    const padLeft = Math.max(0, Math.round((box - textWidth) / unit));
    return space.repeat(padLeft) + line.text;
  }
  if (line.align === "center") {
    const inner = Math.max(0, Math.floor((line.width - textWidth) / (2 * unit)));
    return indent + space.repeat(inner) + line.text;
  }
  return indent + line.text;
}

/** 从 nodes 排成纯文本。好莱坞：场次大写、角色单独一行、对白缩进。亚洲：全角缩进。 */
export function formatScreenplayTxt(doc: ScreenplayDoc): string {
  const lines = layoutScreenplay(doc);
  const fullwidth = doc.format === "asian";
  return lines.map((line) => padPlain(line, fullwidth)).join("\n").replace(/\n+$/, "") + "\n";
}

function triggerDownload(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportTxt(doc: ScreenplayDoc): string {
  const text = formatScreenplayTxt(doc);
  triggerDownload(new Blob([text], { type: "text/plain;charset=utf-8" }), `${safeFilename(doc)}.txt`);
  return text;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

let cjkFontBase64: Promise<string | null> | null = null;

async function loadCjkFontBase64(): Promise<string | null> {
  if (!cjkFontBase64) {
    cjkFontBase64 = (async () => {
      if (typeof fetch === "function") {
        try {
          const origin = typeof window !== "undefined" ? window.location.origin : "";
          const url = origin ? `${origin}/fonts/DroidSansFallbackFull.ttf` : "/fonts/DroidSansFallbackFull.ttf";
          const res = await fetch(url);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            if (buf.byteLength > 1024) return arrayBufferToBase64(buf);
          }
        } catch {
          /* same-origin font is optional */
        }
      }
      return null;
    })();
  }
  return cjkFontBase64;
}

type JsPdfDoc = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  addPage: () => void;
  setFont: (name: string, style?: string) => void;
  setFontSize: (size: number) => void;
  text: (text: string | string[], x: number, y: number, options?: object) => void;
  addImage: (data: string, format: string, x: number, y: number, w: number, h: number) => void;
  addFileToVFS: (filename: string, filecontent: string) => void;
  addFont: (...args: unknown[]) => string;
  output: (type: "arraybuffer") => ArrayBuffer;
  save: (filename: string) => void;
  getNumberOfPages: () => number;
  setPage: (page: number) => void;
};

const CJK_FONT = "ScreenplayCJK";

function registerCjkFont(pdf: JsPdfDoc, base64: string): boolean {
  try {
    pdf.addFileToVFS("ScreenplayCJK.ttf", base64);
    pdf.addFont("ScreenplayCJK.ttf", CJK_FONT, "normal", "Identity-H");
    pdf.addFont("ScreenplayCJK.ttf", CJK_FONT, "bold", "Identity-H");
    pdf.setFont(CJK_FONT, "normal");
    return true;
  } catch {
    return false;
  }
}

function hollywoodCharPt(): number {
  return 12 * 0.6;
}

function asianEmPt(): number {
  return 12;
}

function pageMetrics(format: ScreenplayFormat) {
  if (format === "asian") {
    return {
      page: "a4" as const,
      marginLeft: 72,
      marginRight: 72,
      marginTop: 72,
      marginBottom: 72,
      line: 22,
      char: asianEmPt(),
    };
  }
  return {
    page: "letter" as const,
    marginLeft: 108,
    marginRight: 72,
    marginTop: 72,
    marginBottom: 72,
    line: 12,
    char: hollywoodCharPt(),
  };
}

function drawCanvasLine(
  pdf: JsPdfDoc,
  text: string,
  x: number,
  baselineY: number,
  opts: { font: string; italic?: boolean; bold?: boolean; fontSize?: number }
): boolean {
  if (typeof document === "undefined") return false;
  const fontSize = opts.fontSize ?? 12;
  const scale = 2;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const cssFont = `${opts.italic ? "italic" : "normal"} ${opts.bold ? "700" : "400"} ${fontSize * scale}px ${opts.font}`;
  ctx.font = cssFont;
  const widthPx = Math.max(1, Math.ceil(ctx.measureText(text).width) + 4);
  const heightPx = Math.ceil(fontSize * scale * 1.4);
  canvas.width = widthPx;
  canvas.height = heightPx;
  const redraw = canvas.getContext("2d");
  if (!redraw) return false;
  redraw.font = cssFont;
  redraw.fillStyle = "#000";
  redraw.textBaseline = "alphabetic";
  redraw.fillText(text, 2, fontSize * scale * 0.95);
  const widthPt = widthPx / scale;
  const heightPt = heightPx / scale;
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, baselineY - fontSize * 0.95, widthPt, heightPt);
  return true;
}

function writePdfLine(
  pdf: JsPdfDoc,
  line: LaidLine,
  x: number,
  y: number,
  format: ScreenplayFormat,
  hasEmbeddedCjk: boolean
): void {
  if (!line.text) return;
  const style = line.bold ? "bold" : "normal";
  const useCjk = hasCjk(line.text);
  if (useCjk && hasEmbeddedCjk) {
    pdf.setFont(CJK_FONT, style === "bold" ? "bold" : "normal");
  } else if (useCjk && typeof document !== "undefined") {
    const font =
      format === "asian"
        ? '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif'
        : '"Courier Prime", "Courier New", Courier, monospace';
    if (drawCanvasLine(pdf, line.text, x, y, { font, italic: line.italic, bold: line.bold })) {
      return;
    }
  } else {
    pdf.setFont("courier", style);
  }
  pdf.setFontSize(line.kind === "cover_title" ? 18 : 12);
  const options: { align?: "left" | "center" | "right"; maxWidth?: number } = {};
  if (line.align === "center" || line.align === "right") options.align = line.align;
  pdf.text(line.text, x, y, options);
}

export async function buildScreenplayPdf(doc: ScreenplayDoc): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const format = doc.format === "asian" ? "asian" : "hollywood";
  const metrics = pageMetrics(format);
  const pdf = new jsPDF({
    unit: "pt",
    format: metrics.page,
    compress: true,
  }) as unknown as JsPdfDoc;

  const fontBase64 = await loadCjkFontBase64();
  const hasEmbeddedCjk = fontBase64 ? registerCjkFont(pdf, fontBase64) : false;
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  const lines = layoutScreenplay(doc);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let y = metrics.marginTop;
  pdf.setFontSize(12);
  pdf.setFont("courier", "normal");

  const ensureRoom = (needed: number) => {
    if (y + needed > pageHeight - metrics.marginBottom) {
      pdf.addPage();
      y = metrics.marginTop;
    }
  };

  for (const line of lines) {
    if (line.pageBreakBefore && y > metrics.marginTop + 1) {
      pdf.addPage();
      y = metrics.marginTop;
    }
    if (line.kind === "cover_title") {
      ensureRoom(28);
      const x = pageWidth / 2;
      writePdfLine(pdf, { ...line, align: "center" }, x, y, format, hasEmbeddedCjk);
      y += 28;
      continue;
    }
    if (line.kind === "blank") {
      y += metrics.line;
      continue;
    }
    ensureRoom(metrics.line);
    const indentPt = line.indent * metrics.char;
    let x = metrics.marginLeft + indentPt;
    if (line.align === "center") {
      x = metrics.marginLeft + indentPt + (line.width * metrics.char) / 2;
    } else if (line.align === "right") {
      x = metrics.marginLeft + indentPt + line.width * metrics.char;
    }
    writePdfLine(pdf, line, x, y, format, hasEmbeddedCjk);
    y += metrics.line;
  }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    pdf.setPage(i);
    pdf.setFont("courier", "normal");
    pdf.setFontSize(10);
    pdf.text(String(i), pageWidth / 2, pageHeight - 36, { align: "center" });
  }

  const buffer = pdf.output("arraybuffer");
  return new Blob([buffer], { type: "application/pdf" });
}

export async function exportPdf(doc: ScreenplayDoc): Promise<void> {
  const blob = await buildScreenplayPdf(doc);
  triggerDownload(blob, `${safeFilename(doc)}.pdf`);
}

function twipFromCh(ch: number, format: ScreenplayFormat): number {
  if (format === "asian") return Math.round(ch * 240);
  return Math.round(ch * 144);
}

export async function buildScreenplayDocx(doc: ScreenplayDoc): Promise<Blob> {
  const {
    AlignmentType,
    Document,
    Packer,
    Paragraph,
    TextRun,
    convertInchesToTwip,
    convertMillimetersToTwip,
  } = await import("docx");

  const format = doc.format === "asian" ? "asian" : "hollywood";
  const latinFont = format === "asian" ? "Times New Roman" : "Courier New";
  const eastAsiaFont = format === "asian" ? "SimSun" : "Courier New";
  const lines = layoutScreenplay(doc);
  type IParagraph = InstanceType<typeof Paragraph>;
  const children: IParagraph[] = [];

  for (const line of lines) {
    if (line.kind === "blank") {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "" })],
          spacing: { after: 0, before: 0, line: format === "asian" ? 440 : 240 },
        })
      );
      continue;
    }

    const size = line.kind === "cover_title" ? 36 : 24;
    const alignment =
      line.align === "center"
        ? AlignmentType.CENTER
        : line.align === "right"
          ? AlignmentType.RIGHT
          : AlignmentType.LEFT;

    children.push(
      new Paragraph({
        pageBreakBefore: line.pageBreakBefore,
        alignment,
        indent:
          line.align === "left"
            ? {
                left: twipFromCh(line.indent, format),
                right: 0,
              }
            : line.align === "center"
              ? {
                  left: twipFromCh(line.indent, format),
                  right: twipFromCh(line.indent, format),
                }
              : undefined,
        spacing: {
          after: 0,
          before: 0,
          line: format === "asian" ? 440 : 240,
        },
        autoSpaceEastAsianText: format === "asian",
        children: [
          new TextRun({
            text: line.text,
            bold: line.bold,
            italics: line.italic,
            size,
            font: {
              ascii: latinFont,
              eastAsia: eastAsiaFont,
              hAnsi: latinFont,
            },
          }),
        ],
      })
    );
  }

  if (children.length === 0) {
    children.push(new Paragraph({ text: displayTitle(doc) }));
  }

  const document = new Document({
    title: displayTitle(doc),
    creator: doc.cover.author || "Dramo",
    description: "Screenplay export",
    sections: [
      {
        properties: {
          page: {
            size:
              format === "asian"
                ? {
                    width: convertMillimetersToTwip(210),
                    height: convertMillimetersToTwip(297),
                  }
                : {
                    width: convertInchesToTwip(8.5),
                    height: convertInchesToTwip(11),
                  },
            margin:
              format === "asian"
                ? {
                    top: convertMillimetersToTwip(25),
                    right: convertMillimetersToTwip(25),
                    bottom: convertMillimetersToTwip(25),
                    left: convertMillimetersToTwip(25),
                  }
                : {
                    top: convertInchesToTwip(1),
                    right: convertInchesToTwip(1),
                    bottom: convertInchesToTwip(1),
                    left: convertInchesToTwip(1.5),
                  },
          },
        },
        children,
      },
    ],
  });

  if (typeof Packer.toBlob === "function") {
    try {
      return await Packer.toBlob(document);
    } catch {
      /* Node 没有 Blob 实现时走 buffer */
    }
  }
  const buffer = await Packer.toBuffer(document);
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export async function exportDocx(doc: ScreenplayDoc): Promise<void> {
  const blob = await buildScreenplayDocx(doc);
  triggerDownload(blob, `${safeFilename(doc)}.docx`);
}
