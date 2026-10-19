import { classifyPresenceCoverDrift, coverRebuildsFor, coverageViolationsOf, lacksBase, rebuiltCoverEntries } from './classifyPresenceCoverDrift'
import type { PresenceGraphView } from './classifyPresenceCoverDrift'

const listing = (...hosts: string[]) => ({ members: hosts.map((host) => ({ host, presence: 'PRESENCE#f' })) })
const room = (nodeIds: string[], presenceNodes: PresenceGraphView['presenceNodes']): PresenceGraphView => ({ hostId: 'ROOM#a', nodeIds: ['ROOM#a', ...nodeIds], presenceNodes })
const child = (hostId: string, presenceNodes: PresenceGraphView['presenceNodes']): PresenceGraphView => ({ hostId, nodeIds: [hostId], presenceNodes })
const point = (key: string, presence: string, host = 'ROOM#a') => ({ universalKey: key, fromHostPresence: { host, presence }, cover: { members: [] as { host: string; presence: string }[] } })

const lookup = (graphs: PresenceGraphView[]) => (id: string) => graphs.find((graph) => graph.hostId === id)

describe('classifyPresenceCoverDrift', () => {
    const whole = room(['FEATURE#x'], [{ universalKey: 'PRESENCE#root', cover: listing('FEATURE#x') }])

    it('reads clean when every member holds one pointer to the binding covering it', () => {
        const verdict = classifyPresenceCoverDrift(whole, lookup([child('FEATURE#x', [point('PRESENCE#f', 'PRESENCE#root')])]))
        expect(verdict).toEqual({ findings: [] })
    })

    it('reports a member with no binding as Unbound, and a wrong-binding member as Stale', () => {
        expect(classifyPresenceCoverDrift(whole, lookup([child('FEATURE#x', [])])).findings)
            .toEqual([{ kind: 'Unbound', member: 'FEATURE#x', presence: 'PRESENCE#root' }])
        expect(classifyPresenceCoverDrift(whole, lookup([child('FEATURE#x', [point('PRESENCE#f', 'PRESENCE#gone')])])).findings)
            .toEqual([
                { kind: 'Stale', member: 'FEATURE#x', presence: 'PRESENCE#root' },
                { kind: 'Stale', member: 'FEATURE#x', presence: 'PRESENCE#gone' },
            ])
    })

    it('reports two pointers at one binding as Duplicate', () => {
        const graph = child('FEATURE#x', [point('PRESENCE#f1', 'PRESENCE#root'), point('PRESENCE#f2', 'PRESENCE#root')])
        expect(classifyPresenceCoverDrift(whole, lookup([graph])).findings).toEqual([{ kind: 'Duplicate', member: 'FEATURE#x', presence: 'PRESENCE#root' }])
    })

    it('holds a listed member to its listing binding only, not to another binding', () => {
        const split = room(['FEATURE#x', 'FEATURE#y'], [
            { universalKey: 'PRESENCE#root', cover: listing('FEATURE#y') },
            { universalKey: 'PRESENCE#carve', fromHostPresence: { host: 'AREA#up', presence: 'PRESENCE#top' }, cover: { members: [{ host: 'FEATURE#x', presence: 'PRESENCE#f' }] } },
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
        const none = room([], [{ universalKey: 'PRESENCE#carve', cover: { members: [] } }])
        expect(classifyPresenceCoverDrift(none, lookup([]))).toEqual({ findings: [] })
    })

    it('reads a stored host-only pointer (a retired shape) as Stale, not as a match at host grain', () => {
        const hostOnly = child('FEATURE#x', [{ universalKey: 'PRESENCE#f', fromHostPresence: { host: 'ROOM#a' } as any, cover: { members: [] } }])
        const findings = classifyPresenceCoverDrift(whole, lookup([hostOnly])).findings
        expect(findings.length).toBeGreaterThan(0)
        expect(findings.every(({ kind }) => kind === 'Stale')).toBe(true)
    })

    it('skips an unreadable member', () => {
        expect(classifyPresenceCoverDrift(whole, lookup([])).findings).toEqual([])
    })
})

describe('rebuiltCoverEntries', () => {
    it('lists the members whose pointer names the binding', () => {
        const whole = room(['FEATURE#x', 'FEATURE#y'], [{ universalKey: 'PRESENCE#carve', cover: { members: [] } }])
        const graphs = [child('FEATURE#x', [point('PRESENCE#f', 'PRESENCE#carve')]), child('FEATURE#y', [])]
        expect(rebuiltCoverEntries(whole, 'PRESENCE#carve', lookup(graphs))).toEqual([{ host: 'FEATURE#x', presence: 'PRESENCE#f' }])
    })
})

describe('coverRebuildsFor', () => {
    const carve = { universalKey: 'PRESENCE#carve', fromHostPresence: { host: 'AREA#up', presence: 'PRESENCE#top' }, cover: { members: [] as { host: string; presence: string }[] } }
    it('rewrites only covers that disagree with the pointers, and reads clean after', () => {
        const whole = room(['FEATURE#x'], [{ universalKey: 'PRESENCE#root', cover: { members: [] } }, carve])
        const graphs = [child('FEATURE#x', [point('PRESENCE#f', 'PRESENCE#carve')])]
        expect(coverRebuildsFor(whole, lookup(graphs))).toEqual([{ bindingId: 'PRESENCE#carve', entries: [{ host: 'FEATURE#x', presence: 'PRESENCE#f' }] }])
        const healed = room(['FEATURE#x'], [whole.presenceNodes[0], { ...carve, cover: { members: [{ host: 'FEATURE#x', presence: 'PRESENCE#f' }] } }])
        expect(coverRebuildsFor(healed, lookup(graphs))).toEqual([])
        expect(classifyPresenceCoverDrift(healed, lookup(graphs)).findings).toEqual([])
    })
})

describe('coverageViolationsOf', () => {
    const empty = { members: [] as { host: string; presence: string }[] }

    it('reports a member no binding covers', () => {
        const bare = room(['FEATURE#x', 'FEATURE#y'], [{ universalKey: 'PRESENCE#root', cover: { members: [{ host: 'FEATURE#x', presence: 'PRESENCE#f' }] } }])
        expect(coverageViolationsOf(bare)).toEqual({ uncovered: ['FEATURE#y'], hostlessBindings: [], badUnplaced: [] })
        expect(coverageViolationsOf(room(['FEATURE#x', 'FEATURE#y'], [{ universalKey: 'PRESENCE#root', cover: listing('FEATURE#x', 'FEATURE#y') }])).uncovered).toEqual([])
    })

    it('reports a whole with members and no binding at all', () => {
        expect(coverageViolationsOf(room(['FEATURE#x'], [])).uncovered).toEqual(['FEATURE#x'])
    })

    it('leaves bystanders outside the invariant: a room is covered by its entries, and its characters row is not a graph node', () => {
        // A bystander is indexed by the characters row, never by the room's graph (rule 5), so a Room whose
        // Base lists one feature and whose graph holds no character reads clean.
        const base = { universalKey: 'PRESENCE#Base', cover: { members: [{ host: 'FEATURE#x', presence: 'PRESENCE#f' }] } }
        expect(coverageViolationsOf(room(['FEATURE#x'], [base]))).toEqual({ uncovered: [], hostlessBindings: [], badUnplaced: [] })
    })

    it('lists every hostless binding when there is more than one', () => {
        const two = room([], [{ universalKey: 'PRESENCE#a', cover: empty }, { universalKey: 'PRESENCE#b', cover: empty }])
        expect(coverageViolationsOf(two).hostlessBindings).toEqual(['PRESENCE#a', 'PRESENCE#b'])
        const one = room([], [{ universalKey: 'PRESENCE#a', cover: empty }, point('PRESENCE#b', 'PRESENCE#up', 'AREA#z')])
        expect(coverageViolationsOf(one).hostlessBindings).toEqual([])
    })
})

describe('classifyPresenceCoverDrift: the coverage invariant', () => {
    it('reports Uncovered and SecondHostless as findings', () => {
        const whole = room(['FEATURE#x'], [
            { universalKey: 'PRESENCE#a', cover: { members: [] } },
            { universalKey: 'PRESENCE#b', cover: { members: [] } },
        ])
        expect(classifyPresenceCoverDrift(whole, () => undefined).findings).toEqual([
            { kind: 'Uncovered', member: 'FEATURE#x' },
            { kind: 'SecondHostless', presence: 'PRESENCE#b' },
        ])
    })
})

describe('the Unplaced fixed id', () => {
    const base = { universalKey: 'PRESENCE#Base', cover: { members: [] } }
    const placedBase = { ...base, fromHostPresence: { host: 'ROOM#b', presence: 'PRESENCE#Base' } }
    const unplaced = { universalKey: 'PRESENCE#Unplaced', cover: { members: [] } }

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
        expect(coverageViolationsOf(room([], [placedBase, { ...unplaced, fromHostPresence: { host: 'ROOM#c', presence: 'PRESENCE#Base' } }])).badUnplaced)
            .toEqual(['PRESENCE#Unplaced'])
    })

    it('reports BadUnplaced as a finding', () => {
        expect(classifyPresenceCoverDrift(room([], [base, unplaced]), () => undefined).findings).toContainEqual({ kind: 'BadUnplaced', presence: 'PRESENCE#Unplaced' })
    })
})

describe('lacksBase', () => {
    const rooted = (presenceNodes: PresenceGraphView['presenceNodes']): PresenceGraphView => ({ hostId: 'FEATURE#x', nodeIds: ['FEATURE#x'], presenceNodes })

    it('flags a whole that holds bindings and none is Base', () => {
        expect(lacksBase(rooted([{ universalKey: 'PRESENCE#root', cover: { members: [] } }]))).toBe(true)
    })

    it('passes a whole holding Base, and a whole with no binding at all', () => {
        expect(lacksBase(rooted([{ universalKey: 'PRESENCE#Base', cover: { members: [] } }]))).toBe(false)
        expect(lacksBase(rooted([]))).toBe(false)
    })
})
