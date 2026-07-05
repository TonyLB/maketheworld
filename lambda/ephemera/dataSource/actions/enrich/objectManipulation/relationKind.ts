export type HostRelationalEdgeKind = 'On' | 'Under' | 'Against' | 'Custom'

export type NormalizedRelation =
    | { type: 'enum'; kind: Exclude<HostRelationalEdgeKind, 'Custom'> }
    | { type: 'custom'; kind: 'Custom'; relationLabel: string }

export type NormalizeRelationOutcome =
    | { type: 'success'; relation: NormalizedRelation }
    | { type: 'nestingDefer' }
