import { redirect } from "next/navigation";

export default async function StoryboardRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/screenplay`);
}
