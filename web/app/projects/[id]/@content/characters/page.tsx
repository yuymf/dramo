"use client";

import { useParams } from "next/navigation";
import { DerivedEntityList } from "@/components/entities/DerivedEntityList";

export default function CharactersPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";

  if (!projectId) return null;

  return <DerivedEntityList projectId={projectId} kind="character" />;
}
