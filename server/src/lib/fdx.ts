import type { ScreenplayNode } from '../types/screenplay';

const TYPE_TO_FDX: Record<string, string> = {
  scene_heading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parenthetical',
  transition: 'Transition',
  comment: 'Shot',
  subtitle: 'Action',
};

const FDX_TO_TYPE: Record<string, ScreenplayNode['type']> = {
  'Scene Heading': 'scene_heading',
  Action: 'action',
  Character: 'character',
  Dialogue: 'dialogue',
  Parenthetical: 'parenthetical',
  Transition: 'transition',
  Shot: 'action',
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function unescapeXml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

export function nodesToFdx(nodes: ScreenplayNode[], title: string): string {
  const paragraphs = nodes
    .filter((node) => node.text.trim())
    .map((node) => {
      const type = TYPE_TO_FDX[node.type] ?? 'Action';
      return `    <Paragraph Type="${type}"><Text>${escapeXml(node.text)}</Text></Paragraph>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<FinalDraft DocumentType="Script" Template="No" Version="5">
  <Content>
${paragraphs}
  </Content>
  <TitlePage>
    <Content>
      <Paragraph Type="Title"><Text>${escapeXml(title)}</Text></Paragraph>
    </Content>
  </TitlePage>
</FinalDraft>
`;
}

export function fdxToNodes(xml: string): { title: string; nodes: ScreenplayNode[] } {
  if (!xml.includes('<FinalDraft') && !xml.includes('<finaldraft')) {
    throw new Error('不是有效的 FDX');
  }
  const titleMatch = xml.match(/<Paragraph Type="Title">\s*<Text>([\s\S]*?)<\/Text>/i);
  const title = titleMatch ? unescapeXml(titleMatch[1].replace(/<[^>]+>/g, '')).trim() : '';
  const nodes: ScreenplayNode[] = [];
  const re = /<Paragraph([^>]*)>[\s\S]*?<Text>([\s\S]*?)<\/Text>/gi;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(xml)) !== null) {
    const attrs = match[1];
    const typeMatch = attrs.match(/Type="([^"]+)"/i);
    const fdxType = typeMatch?.[1] ?? 'Action';
    if (fdxType === 'Title') continue;
    const text = unescapeXml(match[2].replace(/<[^>]+>/g, '')).trim();
    if (!text) continue;
    const type = FDX_TO_TYPE[fdxType] ?? 'action';
    nodes.push({ id: `fdx-${index + 1}`, type, text });
    index += 1;
  }
  return { title, nodes };
}
