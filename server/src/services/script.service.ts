import { prisma } from '../lib/db';
import { postAgentOS } from '../lib/agentos-client';

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
      title: string;
      source: 'structured' | 'raw_text';
      form?: string;
      contentType?: string;
      styles?: string[];
      goal?: string;
      keyword?: string;
      topic?: string;
    },
    llmHeaders?: Record<string, string>
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('NOT_FOUND');
    }

    // Generate script synchronously via AgentOS
    const aiResult = await postAgentOS<{ scenes?: any[]; acts?: any[] }>(
      '/agentos/generate_script',
      {
        projectId,
        title: data.title,
        form: data.form,
        contentType: data.contentType,
        styles: data.styles,
        goal: data.goal,
        keyword: data.keyword,
        topic: data.topic,
      },
      { llmHeaders }
    );

    const script = await prisma.script.create({
      data: {
        projectId,
        title: data.title,
        type: data.contentType || 'drama',
        style: data.styles?.[0] || 'casual',
        form: data.form,
        contentType: data.contentType,
        goal: data.goal,
        keyword: data.keyword,
        topic: data.topic,
        status: 'completed',
        scenes: aiResult.scenes || [],
        acts: aiResult.acts || [],
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

    // Regenerate scene synchronously via AgentOS
    const result = await postAgentOS<{ scene?: any; candidates?: any[] }>(
      '/agentos/regenerate_scene',
      {
        scriptId: script.id,
        sceneId,
        context: params?.script,
        styles: params?.styles,
        goal: params?.goal,
      },
      { llmHeaders }
    );

    return { scene: result.scene || result, candidates: result.candidates || [], async: false };
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
