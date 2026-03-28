import { prisma } from '../lib/db';
import { postAgentOS } from '../lib/agentos-client';
import { AppException, ErrorCode } from '../lib/errors';

export class ChatService {
  async getMessages(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
    }

    const messages = await prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    return { data: messages, projectId };
  }

  async sendMessage(
    projectId: string,
    userId: string,
    data: {
      role: string;
      content: string;
      blocks?: any[];
      stream?: boolean;
    },
    llmHeaders?: Record<string, string>
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
    }

    // Store user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        projectId,
        role: 'user',
        content: data.content,
        blocks: data.blocks || [],
      },
    });

    // Get recent conversation history
    const history = await prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    history.reverse();

    const messages = history.map((msg: { role: string; content: string }) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Get AI response via AgentOS
    const aiResponse = await postAgentOS<{
      choices?: Array<{ message: { role: string; content: string } }>;
      content?: string;
      message?: string;
    }>('/agentos/chat_completion', { messages, stream: false }, { llmHeaders });

    const content =
      aiResponse.choices?.[0]?.message?.content ||
      aiResponse.content ||
      aiResponse.message ||
      'No response';

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        projectId,
        role: 'assistant',
        content,
      },
    });

    return {
      userMessage,
      assistantMessage,
    };
  }

  async resetChat(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
    }

    await prisma.chatMessage.deleteMany({
      where: { projectId },
    });

    return {
      projectId,
      reset: true,
      message: '对话已重置',
    };
  }
}
