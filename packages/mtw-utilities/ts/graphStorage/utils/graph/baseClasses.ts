export type GraphEdge <K extends string, D extends Record<string, any>> = {
    from: K;
    to: K;
    context?: string;
    data?: D
}

export const compareEdges = <K extends string, E extends Record<string, any>>(A: GraphEdge<K, E>, B: GraphEdge<K, E>): number => {
    const fromCompare = A.from.localeCompare(B.from)
    return fromCompare ? fromCompare : A.to.localeCompare(B.to)
}

export const edgeToCacheKey = <K extends string, E extends Record<string, any>>(edge: GraphEdge<K, E>): `${K}::${K}` | `${K}::${K}::${string}` => ([[edge.from, edge.to], edge.context ? [edge.context] : []].flat(1).join('::') as `${K}::${K}` | `${K}::${K}::${string}`)
