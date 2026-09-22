"use client";

import { useParams } from "next/navigation";
import { DerivedEntityList } from "@/components/entities/DerivedEntityList";

export default function LocationsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";

  if (!projectId) return null;

  return <DerivedEntityList projectId={projectId} kind="location" />;
}
