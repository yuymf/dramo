"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import {
  addDiscussion,
  copyLibraryProject,
  getLibraryProject,
  listDiscussions,
} from "@/lib/api/collab";

export default function LibraryProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";
  const [name, setName] = useState("");
  const [allowCopy, setAllowCopy] = useState(false);
  const [nodes, setNodes] = useState<Array<{ id: string; text: string }>>([]);
  const [discussions, setDiscussions] = useState<Array<{ id: string; body: string; user: { email: string } }>>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!id) return;
    void Promise.all([getLibraryProject(id), listDiscussions(id)]).then(([doc, talk]) => {
      setName(doc.name);
      setAllowCopy(doc.allowCopy);
      setNodes(doc.screenplay?.nodes ?? []);
      setDiscussions(talk.discussions);
    });
  }, [id]);

  return (
    <div className="min-h-screen flex rice-paper-bg">
      <AppSidebar />
      <main className="flex-1 px-8 lg:px-16 py-16 max-w-4xl">
        <h1 className="text-2xl font-bold mb-2">{name || "公开剧本"}</h1>
        <p className="text-xs mb-6" style={{ color: "#a8a29e" }}>
          公开阅读，不能直接编辑这份稿
        </p>
        {allowCopy && (
          <Button
            className="mb-6"
            onClick={async () => {
              const copied = await copyLibraryProject(id);
              router.push(`/projects/${copied.id}/screenplay`);
            }}
          >
            复制到我的工作区
          </Button>
        )}
        <article className="space-y-2 mb-10">
          {nodes.map((node) => (
            <p key={node.id} className="text-sm whitespace-pre-wrap">
              {node.text}
            </p>
          ))}
        </article>
        <section>
          <h2 className="text-sm font-semibold mb-2">讨论</h2>
          <ul className="space-y-2 mb-3">
            {discussions.map((item) => (
              <li key={item.id} className="text-sm">
                <span style={{ color: "#78716c" }}>{item.user.email}：</span>
                {item.body}
              </li>
            ))}
          </ul>
          <textarea
            aria-label="公开讨论"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full min-h-20 rounded-lg border px-3 py-2 text-sm"
          />
          <Button
            className="mt-2"
            size="sm"
            onClick={async () => {
              if (!draft.trim()) return;
              await addDiscussion(id, draft.trim());
              setDraft("");
              const talk = await listDiscussions(id);
              setDiscussions(talk.discussions);
            }}
          >
            发表
          </Button>
        </section>
      </main>
    </div>
  );
}
