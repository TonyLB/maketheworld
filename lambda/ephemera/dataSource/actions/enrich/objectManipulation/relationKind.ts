/** Deliberately narrow --- ingress lane (LD-13/BD-2): `In`/`PartOf` must not parse into `establishRelation`. This is an ingress-lane authoring restriction, not a claim about which kinds host --- `On` also hosts under AB-54 and still parses here. Do not widen to match the persistence-lane `HostRelationalEdgeKind` in `ephemeraMeta.ts`. */
export type HostRelationalEdgeKind = 'On' | 'Under' | 'Against' | 'Custom'

export type NormalizedRelation =
    | { type: 'enum'; kind: Exclude<HostRelationalEdgeKind, 'Custom'> }
    | { type: 'custom'; kind: 'Custom'; relationLabel: string }

export type NormalizeRelationOutcome =
    | { type: 'success'; relation: NormalizedRelation }
    | { type: 'nestingDefer' }
