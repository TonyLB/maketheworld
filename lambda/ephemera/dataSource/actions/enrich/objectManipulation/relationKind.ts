/** Deliberately narrow --- ingress lane (LD-13/BD-2): `In`/`PartOf` must not parse into `establishRelation`. **`On` joined them 2026-08-22** (Channel D, CD2, reduced scope): AB-54 makes `On` a hosting kind too, and it no longer parses here either (`normalizeRelationSpan.ts`/`relationalTemplates.ts` both defer it, same as containment) -- narrowed out of this type, not just out of the phrase maps, since nothing can construct this type with `'On'` any more. Renamed from `HostRelationalEdgeKind` 2026-08-22: with `On` gone, this is exactly AB-54's peer-kind bucket, not a hosting-inclusive umbrella -- do not widen to match the persistence-lane `HostRelationalEdgeKind` in `ephemeraMeta.ts`, which still spans hosting + peer (and gains `Present` under PR-11). */
export type PeerRelationalEdgeKind = 'Under' | 'Against' | 'Custom'

export type NormalizedRelation =
    | { type: 'enum'; kind: Exclude<PeerRelationalEdgeKind, 'Custom'> }
    | { type: 'custom'; kind: 'Custom'; relationLabel: string }

export type NormalizeRelationOutcome =
    | { type: 'success'; relation: NormalizedRelation }
    | { type: 'nestingDefer' }
