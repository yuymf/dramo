/**
 * 项目首页 - 重定向到台本编辑器
 * 每个项目只有一个台本界面
 */
import { redirect } from "next/navigation";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/scripts`);
}

