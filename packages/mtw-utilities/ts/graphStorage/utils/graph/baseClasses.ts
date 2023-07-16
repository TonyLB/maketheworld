export type GraphEdge <K extends string, E extends Record<string, any>> = E & {
    from: K;
    to: K;
}

export const compareEdges = <K extends string, E extends Record<string, any>>(A: GraphEdge<K, E>, B: GraphEdge<K, E>): number => {
    const fromCompare = A.from.localeCompare(B.from)
    return fromCompare ? fromCompare : A.to.localeCompare(B.to)
}
