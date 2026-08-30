import type { ScreenplayNode } from "@/lib/types/screenplay";

/** 约 180 汉字或 55 英文词计一页（约一分钟）。 */
export const CHARS_PER_PAGE = 180;
export const WORDS_PER_PAGE = 55;

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;

export function estimatePageUnits(text: string): number {
  if (!text) return 0;
  const cjk = text.match(CJK_RE)?.length ?? 0;
  const withoutCjk = text.replace(CJK_RE, " ");
  const words = withoutCjk.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g)?.length ?? 0;
  return cjk / CHARS_PER_PAGE + words / WORDS_PER_PAGE;
}

export interface PageEstimate {
  totalPages: number;
  /** 每个节点所在的大致页码（从 1 起） */
  pageOfNode: number[];
  units: number;
}

export function estimatePages(nodes: ScreenplayNode[]): PageEstimate {
  let acc = 0;
  const pageOfNode = nodes.map((node) => {
    const page = Math.floor(acc) + 1;
    acc += estimatePageUnits(node.text);
    return page;
  });
  const totalPages = Math.max(1, Math.ceil(acc) || 1);
  return { totalPages, pageOfNode, units: acc };
}

export function pageOfActiveNode(
  nodes: ScreenplayNode[],
  activeNodeId: string | null | undefined
): number {
  const { pageOfNode } = estimatePages(nodes);
  const index = nodes.findIndex((node) => node.id === activeNodeId);
  if (index < 0) return 1;
  return pageOfNode[index] ?? 1;
}
