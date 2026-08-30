import { nanoid } from "nanoid";
import { NODE_TYPES, type NodeType, type ScreenplayNode, type ScreenplayFormat } from "@/lib/types/screenplay";

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  scene_heading: "场次标题",
  action: "动作",
  character: "角色",
  dialogue: "对白",
  parenthetical: "括号提示",
  transition: "转场",
  comment: "注释",
  subtitle: "字幕",
};

export function createNode(type: NodeType = "action", text = ""): ScreenplayNode {
  return { id: nanoid(), type, text };
}

export function nextNodeType(current: NodeType, direction: 1 | -1 = 1): NodeType {
  const index = NODE_TYPES.indexOf(current);
  const safeIndex = index < 0 ? 0 : index;
  const next = (safeIndex + direction + NODE_TYPES.length) % NODE_TYPES.length;
  return NODE_TYPES[next];
}

/** Enter 新建下一行：默认动作；上一行是角色则接下对白。 */
export function typeAfterEnter(previous: NodeType): NodeType {
  return previous === "character" ? "dialogue" : "action";
}

export function placeholderFor(type: NodeType, format: ScreenplayFormat): string {
  if (format === "asian") {
    switch (type) {
      case "scene_heading":
        return "内景 地点 - 日";
      case "action":
        return "描写动作与环境…";
      case "character":
        return "角色名";
      case "dialogue":
        return "对白";
      case "parenthetical":
        return "（情绪或动作）";
      case "transition":
        return "切至";
      case "comment":
        return "注释（不进入对白）";
      case "subtitle":
        return "字幕";
    }
  }
  switch (type) {
    case "scene_heading":
      return "INT. LOCATION - DAY";
    case "action":
      return "描写动作与环境…";
    case "character":
      return "CHARACTER";
    case "dialogue":
      return "对白";
    case "parenthetical":
      return "(beat)";
    case "transition":
      return "CUT TO:";
    case "comment":
      return "注释（不进入对白）";
    case "subtitle":
      return "字幕";
  }
}

export function formatLabel(format: ScreenplayFormat): string {
  return format === "asian" ? "亚洲格式" : "好莱坞格式";
}
