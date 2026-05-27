/**
 * 轻量级国际化工具
 */

export type Locale = "zh" | "en";

export const translations = {
  zh: {
    // 通用
    search: "搜索",
    allProject: "全部项目",
    newProject: "新建项目",
    save: "保存",
    export: "导出",
    cancel: "取消",
    confirm: "确认",
    
    // 项目侧栏
    projectName: "华尔街之狼",
    input: "输入",
    script: "台本",
    characters: "角色",
    favorites: "收藏",
    storyboard: "分镜",
    
    // 顶部导航
    projects: "项目",
    dialogue: "对话",
    history: "历史",
    aiAssistant: "AI 助手",
    
    // 模式切换
    scriptMode: "台本式",
    dialogueMode: "分支式",
    hollywoodMode: "分镜式",
    
    // 场景列表
    sceneList: "场景列表",
    
    // 编辑器
    regenerate: "重新生成",
    regenerating: "重新生成中...",
    exportText: "文本格式",
    exportPDF: "PDF 格式",
    exportSRT: "SRT 字幕",
    exportTeleprompter: "提词器",
    noContent: "暂无内容。点击 \"重新生成\" 来生成 AI 内容。",
    insertScene: "插入场景",
    
    // 时间线节点
    timeline: {
      opening: "开场暖场",
      theme: "主题陈述",
      core: "核心环节",
      interaction: "互动",
      closing: "收尾",
    },
    
    // 富文本工具栏
    bold: "粗体",
    italic: "斜体",
    strikethrough: "删除线",
    bulletList: "无序列表",
    orderedList: "有序列表",
    heading2: "标题2",
    heading3: "标题3",
    undo: "撤销",
    redo: "重做",
    
    // 灵感面板
    inspiration: "灵感",
    all: "全部",
    quotes: "引用",
    topics: "话题",
    hotspots: "热点",
    interactions: "互动",
    insert: "插入",
    favorite: "收藏",
    loading: "加载中...",
  },
  en: {
    // Common
    search: "Search",
    allProject: "all Project",
    newProject: "New Project",
    save: "Save",
    export: "Export",
    cancel: "Cancel",
    confirm: "Confirm",
    
    // Project Sidebar
    projectName: "The Wolf of Wall Street",
    input: "Input",
    script: "Script",
    characters: "Characters",
    favorites: "Favorites",
    storyboard: "Storyboard",
    
    // Top Navigation
    projects: "Projects",
    dialogue: "Dialogue",
    history: "History",
    aiAssistant: "AI Assistant",
    
    // Mode Switcher
    scriptMode: "Script",
    dialogueMode: "Dialogue",
    hollywoodMode: "Hollywood",
    
    // Scene List
    sceneList: "Scene List",
    
    // Editor
    regenerate: "Regenerate",
    regenerating: "Regenerating...",
    exportText: "Text Format",
    exportPDF: "PDF Format",
    exportSRT: "SRT Subtitles",
    exportTeleprompter: "Teleprompter",
    noContent: "No content. Click \"Regenerate\" to generate AI content.",
    insertScene: "Insert Scene",
    
    // Timeline Nodes
    timeline: {
      opening: "Opening",
      theme: "Theme",
      core: "Core",
      interaction: "Interaction",
      closing: "Closing",
    },
    
    // Rich Text Toolbar
    bold: "Bold",
    italic: "Italic",
    strikethrough: "Strikethrough",
    bulletList: "Bullet List",
    orderedList: "Ordered List",
    heading2: "Heading 2",
    heading3: "Heading 3",
    undo: "Undo",
    redo: "Redo",
    
    // Inspiration Panel
    inspiration: "Inspiration",
    all: "All",
    quotes: "Quotes",
    topics: "Topics",
    hotspots: "Hotspots",
    interactions: "Interactions",
    insert: "Insert",
    favorite: "Favorite",
    loading: "Loading...",
  },
} as const;

export function useTranslation(locale: Locale = "zh") {
  return {
    t: (key: string) => {
      const keys = key.split(".");
      let value: unknown = translations[locale];
      
      for (const k of keys) {
        value = (value as Record<string, unknown>)?.[k];
        if (value === undefined) return key;
      }
      
      return value as string;
    },
    locale,
  };
}

