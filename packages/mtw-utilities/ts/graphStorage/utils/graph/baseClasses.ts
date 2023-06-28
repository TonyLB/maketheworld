export type GraphEdge <K extends string> = {
    from: K;
    to: K;
}

export const compareEdges = <K extends string>(A: GraphEdge<K>, B: GraphEdge<K>): number => {
    const fromCompare = A.from.localeCompare(B.from)
    return fromCompare ? fromCompare : A.to.localeCompare(B.to)
}
