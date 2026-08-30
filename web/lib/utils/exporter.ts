import type { Script, Act, Scene } from "@/lib/models";

interface ActSceneGroup {
  act?: Act;
  scenes: Scene[];
}

/**
 * Returns scenes grouped by act in order (act.order asc, then act.sceneIds order).
 * If no acts, returns all scenes sorted by scene.order asc.
 */
function getOrderedScenes(script: Script): ActSceneGroup[] {
  const sceneById = new Map(script.scenes.map((s) => [s.id, s]));
  const orderedActs = (script.acts ?? []).slice().sort((a, b) => a.order - b.order);
  
  const groups = orderedActs.map((act) => ({
    act,
    scenes: act.sceneIds.map((id) => sceneById.get(id)).filter((s): s is Scene => !!s),
  }));

  if (groups.length > 0 && groups.some((g) => g.scenes.length > 0)) {
    return groups;
  }

  // Fallback: no acts or empty acts
  return [
    {
      act: undefined,
      scenes: script.scenes.slice().sort((a, b) => a.order - b.order),
    },
  ];
}

/**
 * Strip HTML tags from text
 */
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

export function exportAsText(script: Script): string {
  let output = `# ${script.title}\n\n`;
  output += `Form: ${script.form} | Content Type: ${script.contentType} | Status: ${script.status}\n`;
  output += `Created: ${new Date(script.createdAt).toLocaleString()}\n\n`;
  output += "---\n\n";

  const groups = getOrderedScenes(script);
  groups.forEach((group) => {
    if (group.act) {
      output += `# Act ${group.act.order}: ${group.act.name}\n\n`;
    }

    group.scenes.forEach((scene, sceneIndex) => {
      output += `## Scene ${sceneIndex + 1}: ${scene.title}\n\n`;
      scene.content.forEach((block) => {
        const cleanText = stripHtml(block.text);
        output += `[${block.label}] ${cleanText}\n\n`;
      });
      output += "---\n\n";
    });
  });

  return output;
}

export function exportAsTeleprompter(script: Script): string {
  let output = `${script.title}\n\n`;

  const groups = getOrderedScenes(script);
  groups.forEach((group) => {
    if (group.act) {
      output += `=== Act ${group.act.order}: ${group.act.name} ===\n\n`;
    }

    group.scenes.forEach((scene) => {
      output += `[${scene.title}]\n\n`;
      scene.content.forEach((block) => {
        const cleanText = stripHtml(block.text);
        output += `${cleanText}\n\n`;
      });
    });
  });

  return output;
}

function formatSRTTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(
    3,
    "0"
  )}`;
}

export function exportAsSRT(script: Script): string {
  let output = "";
  let subtitleIndex = 1;
  let cumulativeTime = 0;
  const defaultDuration = 3000;

  const groups = getOrderedScenes(script);
  groups.forEach((group) => {
    group.scenes.forEach((scene) => {
      scene.content.forEach((block) => {
        const cleanText = stripHtml(block.text);
        if (!cleanText.trim()) return;

        const estimatedDuration = Math.max(
          defaultDuration,
          cleanText.length * 200
        );
        const endTime = cumulativeTime + estimatedDuration;

        output += `${subtitleIndex}\n`;
        output += `${formatSRTTimestamp(cumulativeTime)} --> ${formatSRTTimestamp(
          endTime
        )}\n`;
        output += `${cleanText}\n\n`;

        subtitleIndex++;
        cumulativeTime = endTime + 500;
      });
    });
  });

  return output;
}

export function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportAsPDF(script: Script): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const lineHeight = 7;
  let yPosition = margin;

  function checkPageBreak(requiredSpace: number = lineHeight) {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  }

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(script.title, margin, yPosition);
  yPosition += lineHeight * 2;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Form: ${script.form} | Content Type: ${script.contentType}`, margin, yPosition);
  yPosition += lineHeight;
  doc.text(`Created: ${new Date(script.createdAt).toLocaleDateString()}`, margin, yPosition);
  yPosition += lineHeight * 2;

  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += lineHeight;

  const groups = getOrderedScenes(script);
  groups.forEach((group) => {
    if (group.act) {
      checkPageBreak(lineHeight * 3);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`Act ${group.act.order}: ${group.act.name}`, margin, yPosition);
      yPosition += lineHeight * 2;
    }

    group.scenes.forEach((scene, sceneIndex) => {
      checkPageBreak(lineHeight * 3);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Scene ${sceneIndex + 1}: ${scene.title}`, margin, yPosition);
      yPosition += lineHeight * 1.5;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      scene.content.forEach((block) => {
        checkPageBreak(lineHeight * 2);

        doc.setFont("helvetica", "italic");
        doc.text(`[${block.label}]`, margin, yPosition);
        yPosition += lineHeight;

        doc.setFont("helvetica", "normal");
        const cleanText = stripHtml(block.text);
        const textLines = doc.splitTextToSize(
          cleanText,
          pageWidth - margin * 2
        );

        textLines.forEach((line: string) => {
          checkPageBreak();
          doc.text(line, margin, yPosition);
          yPosition += lineHeight;
        });

        yPosition += lineHeight * 0.5;
      });

      checkPageBreak(lineHeight);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += lineHeight * 1.5;
    });
  });

  doc.save(`${script.title}_script.pdf`);
}

export function exportAsMarkdown(script: Script): string {
  let output = `# ${script.title}\n\n`;
  output += `**Form:** ${script.form} | **Content Type:** ${script.contentType} | **Status:** ${script.status}\n\n`;
  output += `**Created:** ${new Date(script.createdAt).toLocaleString()}\n\n`;
  output += "---\n\n";

  const groups = getOrderedScenes(script);
  groups.forEach((group) => {
    if (group.act) {
      output += `## Act ${group.act.order}: ${group.act.name}\n\n`;
    }

    group.scenes.forEach((scene, sceneIndex) => {
      output += `### Scene ${sceneIndex + 1}: ${scene.title}\n\n`;
      scene.content.forEach((block) => {
        const cleanText = stripHtml(block.text);
        output += `- **[${block.label}]** ${cleanText}\n`;
      });
      output += "\n";
    });
  });

  return output;
}

export async function exportAsDOCX(script: Script): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = await import("docx");
  type IParagraph = InstanceType<typeof Paragraph>;

  const children: IParagraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: script.title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  // Metadata
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Form: ${script.form} | Content Type: ${script.contentType} | Status: ${script.status}`,
          size: 20,
        }),
      ],
      spacing: { after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Created: ${new Date(script.createdAt).toLocaleString()}`,
          size: 20,
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Horizontal line
  children.push(
    new Paragraph({
      border: {
        bottom: {
          color: "000000",
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
      spacing: { after: 200 },
    })
  );

  const groups = getOrderedScenes(script);
  groups.forEach((group) => {
    if (group.act) {
      children.push(
        new Paragraph({
          text: `Act ${group.act.order}: ${group.act.name}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        })
      );
    }

    group.scenes.forEach((scene, sceneIndex) => {
      children.push(
        new Paragraph({
          text: `Scene ${sceneIndex + 1}: ${scene.title}`,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 150, after: 150 },
        })
      );

      scene.content.forEach((block) => {
        const cleanText = stripHtml(block.text);

        type ITextRun = InstanceType<typeof TextRun>;
        const runs: ITextRun[] = [
          new TextRun({
            text: `[${block.label}] `,
            italics: true,
          }),
          new TextRun({
            text: cleanText,
          }),
        ];

        children.push(
          new Paragraph({
            children: runs,
            spacing: { after: 100 },
          })
        );
      });

      // Separator line after each scene
      children.push(
        new Paragraph({
          border: {
            bottom: {
              color: "CCCCCC",
              space: 1,
              style: BorderStyle.SINGLE,
              size: 3,
            },
          },
          spacing: { before: 100, after: 200 },
        })
      );
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${script.title}_script.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAsJSON(script: Script): string {
  return JSON.stringify(script, null, 2);
}

/**
 * Get all project assets (characters + locations) for storyboard use
 */
import type { ImageItem } from "@/lib/models";
import { api } from "@/lib/api/client";

interface RemoteAsset {
  id: string;
  name: string;
  description?: string;
  alias?: string;
  images: ImageItem[];
  position?: { x: number; y: number };
}

export async function getProjectAssets(
  projectId: string,
  options?: {
    type?: 'character' | 'location';
    sourceFilter?: 'upload' | 'generated' | 'reference';
  }
): Promise<{
  characters: Array<{
    id: string;
    name: string;
    description?: string;
    alias?: string;
    images: ImageItem[];
    position?: { x: number; y: number };
  }>;
  locations: Array<{
    id: string;
    name: string;
    description?: string;
    alias?: string;
    images: ImageItem[];
  }>;
}> {
  const result = {
    characters: [] as Array<{
      id: string;
      name: string;
      description?: string;
      alias?: string;
      images: ImageItem[];
      position?: { x: number; y: number };
    }>,
    locations: [] as Array<{
      id: string;
      name: string;
      description?: string;
      alias?: string;
      images: ImageItem[];
    }>,
  };

  if (!options?.type || options.type === 'character') {
    try {
      const res = await api<{ data?: RemoteAsset[] }>(
        `/api/projects/${projectId}/characters/assets`
      );
      result.characters = (res.data || []).map((asset) => ({
        id: asset.id,
        name: asset.name,
        description: asset.description,
        alias: asset.alias,
        images: options?.sourceFilter
          ? asset.images.filter((img) => img.source === options.sourceFilter)
          : asset.images,
        position: asset.position,
      }));
    } catch (err) {
      console.error('Failed to load character assets:', err);
    }
  }

  if (!options?.type || options.type === 'location') {
    try {
      const res = await api<{ data?: RemoteAsset[] }>(
        `/api/projects/${projectId}/locations/assets`
      );
      result.locations = (res.data || []).map((asset) => ({
        id: asset.id,
        name: asset.name,
        description: asset.description,
        alias: asset.alias,
        images: options?.sourceFilter
          ? asset.images.filter((img) => img.source === options.sourceFilter)
          : asset.images,
      }));
    } catch (err) {
      console.error('Failed to load location assets:', err);
    }
  }

  return result;
}

