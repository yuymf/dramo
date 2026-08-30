import { prisma } from '../lib/db';
import { startWorkflowRun } from '../lib/agentos-client';

export class ScriptService {
  async getProjectScript(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('NOT_FOUND');
    }

    const script = await prisma.script.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return script;
  }

  async createScript(
    projectId: string,
    userId: string,
    data: {
      title?: string;
      source?: string;
      content?: string;
      form?: string;
      contentType?: string;
      styles?: string[];
      goal?: string;
      keyword?: string;
      topic?: string;
      situation?: string;
      hot_stuffs?: string;
      target?: string;
    },
    llmHeaders?: Record<string, string>
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('NOT_FOUND');
    }

    // Build workflow params from input data
    const workflowParams: Record<string, unknown> = {
      projectId,
    };
    if (data.title) workflowParams.title = data.title;
    if (data.topic) workflowParams.topic = data.topic;
    if (data.keyword) workflowParams.keyword = data.keyword;
    if (data.goal) workflowParams.goal = data.goal;
    if (data.target) workflowParams.target = data.target;
    if (data.contentType) workflowParams.contentType = data.contentType;
    if (data.form) workflowParams.form = data.form;
    if (data.styles) workflowParams.styles = data.styles;
    if (data.hot_stuffs) workflowParams.hot_stuffs = data.hot_stuffs;
    if (data.situation) workflowParams.situation = data.situation;

    // For raw text input (base mode), use topic as the content summary
    if (data.content && !data.topic) {
      workflowParams.topic = data.content.substring(0, 500);
      workflowParams.situation = data.content;
    }

    // Generate script via AgentOS ScriptWorkflow
    const res = await startWorkflowRun(
      'scriptworkflow',
      workflowParams,
      { llmHeaders, timeoutMs: 120000 }
    );

    const workflowResult = (await res.json()) as { content?: string; output?: string; scenes?: any[]; acts?: any[] };
    // AgentOS workflow returns { content: "json_string" }
    const outputStr = workflowResult.content || workflowResult.output || JSON.stringify(workflowResult);
    let parsed: { scenes?: any[]; acts?: any[] };
    try {
      parsed = JSON.parse(outputStr);
    } catch {
      parsed = { scenes: [], acts: [] };
    }

    const script = await prisma.script.create({
      data: {
        projectId,
        title: data.title || data.topic || '未命名剧本',
        type: data.contentType || 'drama',
        style: data.styles?.[0] || 'casual',
        form: data.form,
        contentType: data.contentType,
        goal: data.goal,
        keyword: data.keyword,
        topic: data.topic,
        status: 'completed',
        scenes: parsed.scenes || [],
        acts: parsed.acts || [],
      },
    });

    return { script, async: false };
  }

  async updateScriptContent(
    projectId: string,
    userId: string,
    data: { scenes: any[]; acts?: any[] }
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('NOT_FOUND');
    }

    const script = await prisma.script.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!script) {
      throw new Error('NOT_FOUND');
    }

    // Create version snapshot
    const latestVersion = await prisma.scriptVersion.findFirst({
      where: { scriptId: script.id },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latestVersion?.version || 0) + 1;

    await prisma.scriptVersion.create({
      data: {
        scriptId: script.id,
        version: nextVersion,
        summary: `Version ${nextVersion}`,
        content: {
          scenes: script.scenes,
          acts: script.acts,
        },
      },
    });

    const updated = await prisma.script.update({
      where: { id: script.id },
      data: {
        scenes: data.scenes,
        acts: data.acts,
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  async regenerateScene(
    projectId: string,
    sceneId: string,
    userId: string,
    params?: any,
    llmHeaders?: Record<string, string>
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('NOT_FOUND');
    }

    const script = await prisma.script.findFirst({
      where: { projectId },
    });

    if (!script) {
      throw new Error('NOT_FOUND');
    }

    // Build context: existing script + target scene info
    const scenes = (script.scenes as any[]) || [];
    const targetScene = scenes.find((s: any) => s.id === sceneId);

    if (!targetScene) {
      throw new Error('SCENE_NOT_FOUND');
    }

    const contextStr = JSON.stringify({
      title: script.title,
      acts: script.acts,
      scenes: scenes.map(s => ({
        id: s.id,
        title: s.title,
        location: s.location,
        characters: s.characters,
        blocks: s.blocks,
      })),
      targetSceneId: sceneId,
    });

    // Use ScriptWorkflow to regenerate scene via workflow
    const res = await startWorkflowRun(
      'scriptworkflow',
      {
        projectId,
        topic: `重新生成场景：${targetScene.title || '未命名'}`,
        situation: `请重新生成以下场景。保持整体剧情一致，但创作新的对话和动作。\n\n现有剧本上下文：\n${contextStr}`,
        form: script.form,
        contentType: script.contentType,
        styles: params?.styles || [script.style],
        goal: params?.goal || 'regenerate_scene',
      },
      { llmHeaders, timeoutMs: 120000 }
    );

    const aiResult = (await res.json()) as { content?: string; output?: string; scenes?: any[]; acts?: any[] };
    const outputStr = aiResult.content || aiResult.output || JSON.stringify(aiResult);
    let parsed: { scenes?: any[]; acts?: any[] };
    try {
      parsed = JSON.parse(outputStr);
    } catch {
      parsed = { scenes: [], acts: [] };
    }
    const newScenes = parsed.scenes || [];

    // Find the regenerated scene in the result
    const regenerated = newScenes.length > 0 ? newScenes[newScenes.length - 1] : null;
    const candidates = newScenes.slice(0, Math.max(0, newScenes.length - 1));

    return { scene: regenerated, candidates, async: false };
  }

  async listVersions(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('NOT_FOUND');
    }

    const script = await prisma.script.findFirst({
      where: { projectId },
    });

    if (!script) {
      return { data: [] };
    }

    const versions = await prisma.scriptVersion.findMany({
      where: { scriptId: script.id },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        scriptId: true,
        version: true,
        summary: true,
        author: true,
        createdAt: true,
      },
    });

    return { data: versions };
  }

  async revertToVersion(
    projectId: string,
    versionId: string,
    userId: string
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('NOT_FOUND');
    }

    const version = await prisma.scriptVersion.findUnique({
      where: { id: versionId },
      include: { script: true },
    });

    if (!version || version.script.projectId !== projectId) {
      throw new Error('NOT_FOUND');
    }

    const content = version.content as any;
    const current = version.script;

    const latestVersion = await prisma.scriptVersion.findFirst({
      where: { scriptId: current.id },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latestVersion?.version || 0) + 1;

    await prisma.scriptVersion.create({
      data: {
        scriptId: current.id,
        version: nextVersion,
        summary: `Before revert to v${version.version}`,
        content: {
          scenes: current.scenes,
          acts: current.acts,
        },
      },
    });

    const updated = await prisma.script.update({
      where: { id: version.scriptId },
      data: {
        scenes: content.scenes || [],
        acts: content.acts || [],
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      versionId,
      script: updated,
      message: `已回滚到版本 ${version.version}`,
    };
  }
}
