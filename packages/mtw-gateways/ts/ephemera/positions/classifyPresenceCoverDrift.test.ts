import { classifyPresenceCoverDrift, coverRebuildsFor, coverageViolationsOf, lacksBase, orphanRepairsFor, orphanedPointersOf, rebuiltCoverEntries } from './classifyPresenceCoverDrift'
import type { PresenceGraphView } from './classifyPresenceCoverDrift'

const listing = (...hosts: string[]) => ({ members: hosts.map((host) => ({ host, presence: 'PRESENCE#f' })) })
const room = (nodeIds: string[], presenceNodes: PresenceGraphView['presenceNodes']): PresenceGraphView => ({ hostId: 'ROOM#a', nodeIds: ['ROOM#a', ...nodeIds], presenceNodes })
const child = (hostId: string, presenceNodes: PresenceGraphView['presenceNodes']): PresenceGraphView => ({ hostId, nodeIds: [hostId], presenceNodes })
const point = (key: string, presence: string, host = 'ROOM#a') => ({ universalKey: key, fromHostPresences: [{ host, presence }], cover: { members: [] as { host: string; presence: string }[] } })

const lookup = (graphs: PresenceGraphView[]) => (id: string) => graphs.find((graph) => graph.hostId === id)

describe('classifyPresenceCoverDrift', () => {
    const host = room(['FEATURE#x'], [{ universalKey: 'PRESENCE#root', fromHostPresences: [], cover: listing('FEATURE#x') }])

    it('reads clean when every member holds one pointer to the binding covering it', () => {
        const verdict = classifyPresenceCoverDrift(host, lookup([child('FEATURE#x', [point('PRESENCE#f', 'PRESENCE#root')])]))
        expect(verdict).toEqual({ findings: [] })
    })

    it('reports a member with no binding as Unbound, and a wrong-binding member as Stale', () => {
        expect(classifyPresenceCoverDrift(host, lookup([child('FEATURE#x', [])])).findings)
            .toEqual([{ kind: 'Unbound', member: 'FEATURE#x', presence: 'PRESENCE#root' }])
        expect(classifyPresenceCoverDrift(host, lookup([child('FEATURE#x', [point('PRESENCE#f', 'PRESENCE#gone')])])).findings)
            .toEqual([
                { kind: 'Stale', member: 'FEATURE#x', presence: 'PRESENCE#root' },
                { kind: 'Stale', member: 'FEATURE#x', presence: 'PRESENCE#gone' },
            ])
    })

    it('reports two pointers at one binding as Duplicate', () => {
        const graph = child('FEATURE#x', [point('PRESENCE#f1', 'PRESENCE#root'), point('PRESENCE#f2', 'PRESENCE#root')])
        expect(classifyPresenceCoverDrift(host, lookup([graph])).findings).toEqual([{ kind: 'Duplicate', member: 'FEATURE#x', presence: 'PRESENCE#root' }])
    })

    it('holds a listed member to its listing binding only, not to another binding', () => {
        const split = room(['FEATURE#x', 'FEATURE#y'], [
            { universalKey: 'PRESENCE#root', fromHostPresences: [], cover: listing('FEATURE#y') },
            { universalKey: 'PRESENCE#carve', fromHostPresences: [{ host: 'AREA#up', presence: 'PRESENCE#top' }], cover: { members: [{ host: 'FEATURE#x', presence: 'PRESENCE#f' }] } },
        ])
        const graphs = [
            child('FEATURE#x', [point('PRESENCE#f', 'PRESENCE#carve')]),
            child('FEATURE#y', [point('PRESENCE#g', 'PRESENCE#root')]),
        ]
        expect(classifyPresenceCoverDrift(split, lookup(graphs)).findings).toEqual([])
        expect(classifyPresenceCoverDrift(split, lookup([child('FEATURE#x', [point('PRESENCE#f', 'PRESENCE#root')]), graphs[1]])).findings.map((f) => f.kind))
            .toEqual(['Stale', 'Stale'])
    })

    it('treats an empty-cover binding as covering nothing', () => {
        const none = room([], [{ universalKey: 'PRESENCE#carve', fromHostPresences: [], cover: { members: [] } }])
        expect(classifyPresenceCoverDrift(none, lookup([]))).toEqual({ findings: [] })
    })

    it('reads a stored host-only pointer (a retired shape) as Stale, not as a match at host grain', () => {
        const hostOnly = child('FEATURE#x', [{ universalKey: 'PRESENCE#f', fromHostPresences: [{ host: 'ROOM#a' } as any], cover: { members: [] } }])
        const findings = classifyPresenceCoverDrift(host, lookup([hostOnly])).findings
        expect(findings.length).toBeGreaterThan(0)
        expect(findings.every(({ kind }) => kind === 'Stale')).toBe(true)
    })

    it('skips an unreadable member', () => {
        expect(classifyPresenceCoverDrift(host, lookup([])).findings).toEqual([])
    })
})

describe('rebuiltCoverEntries', () => {
    it('lists the members whose pointer names the binding', () => {
        const host = room(['FEATURE#x', 'FEATURE#y'], [{ universalKey: 'PRESENCE#carve', fromHostPresences: [], cover: { members: [] } }])
        const graphs = [child('FEATURE#x', [point('PRESENCE#f', 'PRESENCE#carve')]), child('FEATURE#y', [])]
        expect(rebuiltCoverEntries(host, 'PRESENCE#carve', lookup(graphs))).toEqual([{ host: 'FEATURE#x', presence: 'PRESENCE#f' }])
    })
})

describe('coverRebuildsFor', () => {
    const carve = { universalKey: 'PRESENCE#carve', fromHostPresences: [{ host: 'AREA#up', presence: 'PRESENCE#top' }], cover: { members: [] as { host: string; presence: string }[] } }
    it('rewrites only covers that disagree with the pointers, and reads clean after', () => {
        const host = room(['FEATURE#x'], [{ universalKey: 'PRESENCE#root', fromHostPresences: [], cover: { members: [] } }, carve])
        const graphs = [child('FEATURE#x', [point('PRESENCE#f', 'PRESENCE#carve')])]
        expect(coverRebuildsFor(host, lookup(graphs))).toEqual([{ bindingId: 'PRESENCE#carve', entries: [{ host: 'FEATURE#x', presence: 'PRESENCE#f' }] }])
        const healed = room(['FEATURE#x'], [host.presenceNodes[0], { ...carve, cover: { members: [{ host: 'FEATURE#x', presence: 'PRESENCE#f' }] } }])
        expect(coverRebuildsFor(healed, lookup(graphs))).toEqual([])
        expect(classifyPresenceCoverDrift(healed, lookup(graphs)).findings).toEqual([])
    })
})

describe('coverageViolationsOf', () => {
    const empty = { members: [] as { host: string; presence: string }[] }

    it('reports a member no binding covers', () => {
        const bare = room(['FEATURE#x', 'FEATURE#y'], [{ universalKey: 'PRESENCE#root', fromHostPresences: [], cover: { members: [{ host: 'FEATURE#x', presence: 'PRESENCE#f' }] } }])
        expect(coverageViolationsOf(bare)).toEqual({ uncovered: ['FEATURE#y'], hostlessBindings: [], badUnplaced: [] })
        expect(coverageViolationsOf(room(['FEATURE#x', 'FEATURE#y'], [{ universalKey: 'PRESENCE#root', fromHostPresences: [], cover: listing('FEATURE#x', 'FEATURE#y') }])).uncovered).toEqual([])
    })

    it('reports a host with members and no binding at all', () => {
        expect(coverageViolationsOf(room(['FEATURE#x'], [])).uncovered).toEqual(['FEATURE#x'])
    })

    it('leaves bystanders outside the invariant: a room is covered by its entries, and its characters row is not a graph node', () => {
        // A bystander is indexed by the characters row, never by the room's graph (rule 5), so a Room whose
        // Base lists one feature and whose graph holds no character reads clean.
        const base = { universalKey: 'PRESENCE#Base', fromHostPresences: [], cover: { members: [{ host: 'FEATURE#x', presence: 'PRESENCE#f' }] } }
        expect(coverageViolationsOf(room(['FEATURE#x'], [base]))).toEqual({ uncovered: [], hostlessBindings: [], badUnplaced: [] })
    })

    it('lists every hostless binding when there is more than one', () => {
        const two = room([], [{ universalKey: 'PRESENCE#a', fromHostPresences: [], cover: empty }, { universalKey: 'PRESENCE#b', fromHostPresences: [], cover: empty }])
        expect(coverageViolationsOf(two).hostlessBindings).toEqual(['PRESENCE#a', 'PRESENCE#b'])
        const one = room([], [{ universalKey: 'PRESENCE#a', fromHostPresences: [], cover: empty }, point('PRESENCE#b', 'PRESENCE#up', 'AREA#z')])
        expect(coverageViolationsOf(one).hostlessBindings).toEqual([])
    })
})

describe('classifyPresenceCoverDrift: the coverage invariant', () => {
    it('reports Uncovered and SecondHostless as findings', () => {
        const host = room(['FEATURE#x'], [
            { universalKey: 'PRESENCE#a', fromHostPresences: [], cover: { members: [] } },
            { universalKey: 'PRESENCE#b', fromHostPresences: [], cover: { members: [] } },
        ])
        expect(classifyPresenceCoverDrift(host, () => undefined).findings).toEqual([
            { kind: 'Uncovered', member: 'FEATURE#x' },
            { kind: 'SecondHostless', presence: 'PRESENCE#b' },
        ])
    })
})

describe('the Unplaced fixed id', () => {
    const base = { universalKey: 'PRESENCE#Base', fromHostPresences: [], cover: { members: [] } }
    const placedBase = { ...base, fromHostPresences: [{ host: 'ROOM#b', presence: 'PRESENCE#Base' }] }
    const unplaced = { universalKey: 'PRESENCE#Unplaced', fromHostPresences: [], cover: { members: [] } }

    it('accepts Unplaced while Base has a parent pointer', () => {
        expect(coverageViolationsOf(room([], [placedBase, unplaced])).badUnplaced).toEqual([])
    })

    it('rejects Unplaced beside a hostless Base (and reports the second hostless binding too)', () => {
        const verdict = coverageViolationsOf(room([], [base, unplaced]))
        expect(verdict.badUnplaced).toEqual(['PRESENCE#Unplaced'])
        expect(verdict.hostlessBindings).toEqual(['PRESENCE#Base', 'PRESENCE#Unplaced'])
    })

    it('rejects Unplaced with no Base at all, and Unplaced that holds a parent pointer', () => {
        expect(coverageViolationsOf(room([], [unplaced])).badUnplaced).toEqual(['PRESENCE#Unplaced'])
        expect(coverageViolationsOf(room([], [placedBase, { ...unplaced, fromHostPresences: [{ host: 'ROOM#c', presence: 'PRESENCE#Base' }] }])).badUnplaced)
            .toEqual(['PRESENCE#Unplaced'])
    })

    it('reports BadUnplaced as a finding', () => {
        expect(classifyPresenceCoverDrift(room([], [base, unplaced]), () => undefined).findings).toContainEqual({ kind: 'BadUnplaced', presence: 'PRESENCE#Unplaced' })
    })
})

describe('lacksBase', () => {
    const rooted = (presenceNodes: PresenceGraphView['presenceNodes']): PresenceGraphView => ({ hostId: 'FEATURE#x', nodeIds: ['FEATURE#x'], presenceNodes })

    it('flags a host that holds bindings and none is Base', () => {
        expect(lacksBase(rooted([{ universalKey: 'PRESENCE#root', fromHostPresences: [], cover: { members: [] } }]))).toBe(true)
    })

    it('passes a host holding Base, and a host with no binding at all', () => {
        expect(lacksBase(rooted([{ universalKey: 'PRESENCE#Base', fromHostPresences: [], cover: { members: [] } }]))).toBe(false)
        expect(lacksBase(rooted([]))).toBe(false)
    })
})

describe('orphanedPointersOf', () => {
    const host = (nodeIds: string[]): PresenceGraphView => ({ hostId: 'FEATURE#h', nodeIds: ['FEATURE#h', ...nodeIds], presenceNodes: [{ universalKey: 'PRESENCE#root', fromHostPresences: [], cover: { members: [] } }] })
    const object = (pointers: PresenceGraphView['presenceNodes']) => child('OBJECT#o', pointers)
    const aimed = [point('PRESENCE#b', 'PRESENCE#root', 'FEATURE#h')]

    it('reads clean when the host holds the node', () => {
        expect(orphanedPointersOf(object(aimed), lookup([host(['OBJECT#o'])]))).toEqual([])
    })

    it('finds a pointer whose host lacks the node, repairable when the host holds the named binding', () => {
        const view = lookup([host([])])
        expect(orphanedPointersOf(object(aimed), view)).toEqual([{ host: 'FEATURE#h', presence: 'PRESENCE#root', repairable: true }])
        expect(orphanRepairsFor(object(aimed), view)).toEqual([{ bindingId: 'PRESENCE#b', fromHostPresence: { host: 'FEATURE#h', presence: 'PRESENCE#root' } }])
    })

    it('reports a missing host, or a missing named binding, as report-only', () => {
        expect(orphanedPointersOf(object(aimed), lookup([]))).toEqual([{ host: 'FEATURE#h', presence: 'PRESENCE#root', repairable: false }])
        const wrong = [point('PRESENCE#b', 'PRESENCE#gone', 'FEATURE#h')]
        expect(orphanedPointersOf(object(wrong), lookup([host([])]))).toEqual([{ host: 'FEATURE#h', presence: 'PRESENCE#gone', repairable: false }])
        expect(orphanRepairsFor(object(wrong), lookup([host([])]))).toEqual([])
    })

    it('leaves a character at a room (a bystander) alone, but not a character at a feature', () => {
        const roomHost: PresenceGraphView = { hostId: 'ROOM#a', nodeIds: ['ROOM#a'], presenceNodes: [{ universalKey: 'PRESENCE#root', fromHostPresences: [], cover: { members: [] } }] }
        expect(orphanedPointersOf(child('CHARACTER#c', [point('PRESENCE#b', 'PRESENCE#root', 'ROOM#a')]), lookup([roomHost]))).toEqual([])
        expect(orphanedPointersOf(child('CHARACTER#c', aimed), lookup([host([])]))).toHaveLength(1)
    })

    it('skips a pointer with no presence (a retired shape)', () => {
        const retired = [{ universalKey: 'PRESENCE#b', fromHostPresences: [{ host: 'FEATURE#h' } as any], cover: { members: [] } }]
        expect(orphanedPointersOf(object(retired), lookup([host([])]))).toEqual([])
    })
})

describe('a shared binding (parent sets, PR-25)', () => {
    // the backgammon-set shape: the host holds two bindings, and the member's one binding sits under both
    const entry = { host: 'FEATURE#x', presence: 'PRESENCE#f' }
    const twoParents = () => room(['FEATURE#x'], [
        { universalKey: 'PRESENCE#root', fromHostPresences: [], cover: { members: [entry] } },
        { universalKey: 'PRESENCE#carve', fromHostPresences: [{ host: 'AREA#up', presence: 'PRESENCE#top' }], cover: { members: [entry] } },
    ])
    const shared = child('FEATURE#x', [{
        universalKey: 'PRESENCE#f',
        fromHostPresences: [{ host: 'ROOM#a', presence: 'PRESENCE#root' }, { host: 'ROOM#a', presence: 'PRESENCE#carve' }],
        cover: { members: [] },
    }])

    it('reads clean when one binding is named by each parent cover that lists it', () => {
        expect(classifyPresenceCoverDrift(twoParents(), lookup([shared])).findings).toEqual([])
        expect(coverRebuildsFor(twoParents(), lookup([shared]))).toEqual([])
    })

    it('rebuilds a cover that lacks the shared binding, and only that one', () => {
        const host = twoParents()
        host.presenceNodes[1] = { ...host.presenceNodes[1], cover: { members: [] } }

        expect(classifyPresenceCoverDrift(host, lookup([shared])).findings).toEqual([{ kind: 'Stale', member: 'FEATURE#x', presence: 'PRESENCE#carve' }])
        expect(coverRebuildsFor(host, lookup([shared]))).toEqual([{ bindingId: 'PRESENCE#carve', entries: [entry] }])
    })

    it('reports a second binding under a parent the shared one names as Duplicate, and lists both in the rebuilt cover', () => {
        const extra = child('FEATURE#x', [...shared.presenceNodes, point('PRESENCE#g', 'PRESENCE#carve')])

        expect(classifyPresenceCoverDrift(twoParents(), lookup([extra])).findings).toEqual([{ kind: 'Duplicate', member: 'FEATURE#x', presence: 'PRESENCE#carve' }])
        expect(rebuiltCoverEntries(twoParents(), 'PRESENCE#carve', lookup([extra])).map(({ presence }) => presence)).toEqual(['PRESENCE#f', 'PRESENCE#g'])
    })

    it('reports one binding naming the same parent twice as Duplicate', () => {
        const twice = child('FEATURE#x', [{
            universalKey: 'PRESENCE#f',
            fromHostPresences: [{ host: 'ROOM#a', presence: 'PRESENCE#root' }, { host: 'ROOM#a', presence: 'PRESENCE#root' }],
            cover: { members: [] },
        }])

        expect(classifyPresenceCoverDrift(twoParents(), lookup([twice])).findings).toContainEqual({ kind: 'Duplicate', member: 'FEATURE#x', presence: 'PRESENCE#root' })
    })
})
