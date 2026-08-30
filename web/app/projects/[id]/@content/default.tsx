import { redirect } from "next/navigation";

/**
 * /projects/:id 没有匹配的 @content 页时，进入剧本正文。
 * 布局只渲染 content，不渲染 children，所以 page.tsx 的 redirect 不会生效。
 */
export default async function DefaultContentSlot({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/screenplay`);
}
