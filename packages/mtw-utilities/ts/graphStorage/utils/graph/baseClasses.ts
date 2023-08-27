export type GraphEdge <K extends string, E extends Record<string, any>> = Omit<E, 'from' | 'to'> & {
    from: K;
    to: K;
}

export const compareEdges = <K extends string, E extends Record<string, any>>(A: GraphEdge<K, E>, B: GraphEdge<K, E>): number => {
    const fromCompare = A.from.localeCompare(B.from)
    return fromCompare ? fromCompare : A.to.localeCompare(B.to)
}
