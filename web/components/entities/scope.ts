import type { DerivedEntityKind } from "@/lib/api/entities";

export function entityScopeEvent(kind: DerivedEntityKind) {
  return kind === "character" ? "dramo-character-scope" : "dramo-location-scope";
}

export function entityScopeRequestEvent(kind: DerivedEntityKind) {
  return `${entityScopeEvent(kind)}-request`;
}

export function entityRevisedEvent(kind: DerivedEntityKind) {
  return `${entityScopeEvent(kind)}-revised`;
}

export function dispatchEntityScope(kind: DerivedEntityKind, id: string | null) {
  window.dispatchEvent(new CustomEvent(entityScopeEvent(kind), { detail: { id } }));
}

export function requestEntityScope(kind: DerivedEntityKind) {
  window.dispatchEvent(new Event(entityScopeRequestEvent(kind)));
}
