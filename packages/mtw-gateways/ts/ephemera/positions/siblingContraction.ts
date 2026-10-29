/**
 * The contraction rule for **siblings**: bindings of one host that share a parent binding. One definition
 * shared by the planner (which writes the contractions), the kernel's end-of-run check and the drift
 * classifier's `Duplicate` (which refuse or report a pair the rule would still merge). Plain structural
 * types, so the sweep can feed raw stored rows.
 *
 * A binding's **neighbors** are the bindings it shares a `ConnectedTo` edge with (the edge is symmetric),
 * and its degree is how many it has. Two siblings merge when:
 * - **bare:** either has no edge. Only position tells it from its siblings, so it merges into one, whatever
 *   edges that one has;
 * - **adjacent:** they are neighbors, at least one has at most two edges, and they share no other neighbor.
 *   This keeps branch points from merging (two bindings each with three or more edges) and loops from
 *   collapsing (a shared neighbor). Shortening a string, down to one binding, changes neither.
 *
 * Two siblings that both have edges, with no edge between them, stay apart: a thread that passes one
 * room twice is two stretches there. An automatic contraction never changes the topology, where
 * topology means branch points and loops.
 */

export type ContractionParent = { host: string; presence: string }

/** `Key` is the binding key's type: `string` for a raw stored row, a narrower id where the caller has one. */
export type ContractionBinding<Key extends string = string> = {
    universalKey: Key
    fromHostPresences: readonly ContractionParent[]
}

/** A `ConnectedTo` edge between two bindings of one host, as the binding keys at its ends (stored order). */
export type ConnectedToPair<Key extends string = string> = readonly [Key, Key]

export type MergeablePair<Key extends string = string> = {
    parent: ContractionParent
    bindings: readonly [Key, Key]
    reason: 'bare' | 'adjacent'
}

const parentKey = ({ host, presence }: ContractionParent): string => `${host}|${presence}`

const neighborsOf = <Key extends string>(connectedTo: readonly ConnectedToPair<Key>[]): Map<Key, Set<Key>> => (
    connectedTo.reduce((accumulator, [from, to]) => {
        if (from === to) {
            return accumulator
        }
        accumulator.set(from, new Set([...(accumulator.get(from) ?? []), to]))
        accumulator.set(to, new Set([...(accumulator.get(to) ?? []), from]))
        return accumulator
    }, new Map<Key, Set<Key>>())
)

const reasonFor = <Key extends string>(neighbors: Map<Key, Set<Key>>, a: Key, b: Key): MergeablePair['reason'] | undefined => {
    const ofA = neighbors.get(a) ?? new Set<Key>()
    const ofB = neighbors.get(b) ?? new Set<Key>()
    if (ofA.size === 0 || ofB.size === 0) {
        return 'bare'
    }
    const shareAnother = [...ofA].some((neighbor) => ofB.has(neighbor))
    return ofA.has(b) && (ofA.size <= 2 || ofB.size <= 2) && !shareAnother ? 'adjacent' : undefined
}

/**
 * The first pair of `bindings` under `parent` that the rule merges, or `undefined`. Degrees count every
 * edge in `connectedTo`, so `bindings` may be a subset of the host's.
 */
export const mergeablePairUnder = <Key extends string>(
    parent: ContractionParent,
    bindings: readonly ContractionBinding<Key>[],
    connectedTo: readonly ConnectedToPair<Key>[]
): MergeablePair<Key> | undefined => {
    const neighbors = neighborsOf(connectedTo)
    const under = [...new Set(bindings
        .filter(({ fromHostPresences }) => fromHostPresences.some((candidate) => parentKey(candidate) === parentKey(parent)))
        .map(({ universalKey }) => universalKey))]
    for (const [index, a] of under.entries()) {
        for (const b of under.slice(index + 1)) {
            const reason = reasonFor(neighbors, a, b)
            if (reason) {
                return { parent, bindings: [a, b], reason }
            }
        }
    }
    return undefined
}

/** The first pair of a host's bindings, under any parent binding, that the rule merges, or `undefined`. */
export const mergeablePairOf = <Key extends string>(
    bindings: readonly ContractionBinding<Key>[],
    connectedTo: readonly ConnectedToPair<Key>[]
): MergeablePair<Key> | undefined => {
    const parents = [...new Map(bindings.flatMap(({ fromHostPresences }) => fromHostPresences).map((parent) => [parentKey(parent), parent])).values()]
    return parents.reduce<MergeablePair<Key> | undefined>((found, parent) => found ?? mergeablePairUnder(parent, bindings, connectedTo), undefined)
}

export type Contraction<Key extends string = string> = {
    survivor: Key
    absorbed: Key
    reason: MergeablePair['reason']
    /** Every edge on the absorbed binding as it stands before this merge, to be dissolved first. */
    dissolve: readonly ConnectedToPair<Key>[]
    /** The absorbed binding's other edges, rewritten onto the survivor, to be established after the join. */
    establish: readonly ConnectedToPair<Key>[]
}

/**
 * The merges the rule makes, in order, until no mergeable pair is left. After each merge the survivor
 * holds the union of both parent sets and the absorbed binding's other edges, so a later merge sees them
 * (a stretch pulled off a pulley contracts with the stretches on both sides in turn). `rank` orders the
 * survivor of each pair, lowest first (the caller puts Base first, since Base is never dispensed with);
 * ties go to the binding listed first.
 */
export const contractionsOf = <Key extends string>(
    bindings: readonly ContractionBinding<Key>[],
    connectedTo: readonly ConnectedToPair<Key>[],
    rank: (universalKey: Key) => number
): { contractions: Contraction<Key>[]; bindings: ContractionBinding<Key>[]; connectedTo: ConnectedToPair<Key>[] } => {
    const order = (key: Key) => bindings.findIndex(({ universalKey }) => universalKey === key)
    const step = (
        state: { contractions: Contraction<Key>[]; bindings: ContractionBinding<Key>[]; connectedTo: ConnectedToPair<Key>[] }
    ): typeof state => {
        const pair = mergeablePairOf(state.bindings, state.connectedTo)
        if (!pair) {
            return state
        }
        const [survivor, absorbed] = [...pair.bindings].sort((a, b) => (rank(a) - rank(b)) || (order(a) - order(b)))
        const dissolve = state.connectedTo.filter(([from, to]) => from === absorbed || to === absorbed)
        const already = neighborsOf(state.connectedTo).get(survivor) ?? new Set<Key>()
        const establish = [...new Set(dissolve.map(([from, to]) => (from === absorbed ? to : from)))]
            .filter((neighbor) => neighbor !== survivor && neighbor !== absorbed && !already.has(neighbor))
            .map((neighbor): ConnectedToPair<Key> => [survivor, neighbor])
        const absorbedParents = state.bindings.find(({ universalKey }) => universalKey === absorbed)?.fromHostPresences ?? []
        return step({
            contractions: [...state.contractions, { survivor, absorbed, reason: pair.reason, dissolve, establish }],
            bindings: state.bindings
                .filter(({ universalKey }) => universalKey !== absorbed)
                .map((binding) => (binding.universalKey === survivor
                    ? {
                        ...binding,
                        fromHostPresences: [...new Map([...binding.fromHostPresences, ...absorbedParents].map((parent) => [parentKey(parent), parent])).values()],
                    }
                    : binding)),
            connectedTo: [...state.connectedTo.filter((edge) => !dissolve.includes(edge)), ...establish],
        })
    }
    return step({ contractions: [], bindings: [...bindings], connectedTo: [...connectedTo] })
}
