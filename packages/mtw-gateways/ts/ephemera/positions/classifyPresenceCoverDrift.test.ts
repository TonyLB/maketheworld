import { classifyPresenceCoverDrift, coverRebuildsFor, rebuiltCoverEntries } from './classifyPresenceCoverDrift'
import type { PresenceGraphView } from './classifyPresenceCoverDrift'

const REMAINDER = { members: [{ tag: 'Remainder' as const }] }
const room = (nodeIds: string[], presenceNodes: PresenceGraphView['presenceNodes']): PresenceGraphView => ({ hostId: 'ROOM#a', nodeIds: ['ROOM#a', ...nodeIds], presenceNodes })
const child = (hostId: string, presenceNodes: PresenceGraphView['presenceNodes']): PresenceGraphView => ({ hostId, nodeIds: [hostId], presenceNodes })
const point = (key: string, presence: string, host = 'ROOM#a') => ({ universalKey: key, fromHostPresence: { host, presence }, cover: REMAINDER })

const lookup = (graphs: PresenceGraphView[]) => (id: string) => graphs.find((graph) => graph.hostId === id)

describe('classifyPresenceCoverDrift', () => {
    const whole = room(['FEATURE#x'], [{ universalKey: 'PRESENCE#root', cover: REMAINDER }])

    it('reads clean when every member holds one pointer to the binding covering it', () => {
        const verdict = classifyPresenceCoverDrift(whole, lookup([child('FEATURE#x', [point('PRESENCE#f', 'PRESENCE#root')])]))
        expect(verdict).toEqual({ noRemainder: false, findings: [] })
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

    it('holds a listed member to its listing binding only, not the remainder', () => {
        const split = room(['FEATURE#x', 'FEATURE#y'], [
            { universalKey: 'PRESENCE#root', cover: REMAINDER },
            { universalKey: 'PRESENCE#carve', cover: { members: [{ host: 'FEATURE#x', presence: 'PRESENCE#f' }] } },
        ])
        const graphs = [
            child('FEATURE#x', [point('PRESENCE#f', 'PRESENCE#carve')]),
            child('FEATURE#y', [point('PRESENCE#g', 'PRESENCE#root')]),
        ]
        expect(classifyPresenceCoverDrift(split, lookup(graphs)).findings).toEqual([])
        expect(classifyPresenceCoverDrift(split, lookup([child('FEATURE#x', [point('PRESENCE#f', 'PRESENCE#root')]), graphs[1]])).findings.map((f) => f.kind))
            .toEqual(['Stale', 'Stale'])
    })

    it('reports a whole with no remainder, and treats an empty-cover binding as covering nothing', () => {
        const none = room([], [{ universalKey: 'PRESENCE#carve', cover: { members: [] } }])
        expect(classifyPresenceCoverDrift(none, lookup([]))).toEqual({ noRemainder: true, findings: [] })
    })

    it('reads a stored host-only pointer (a retired shape) as Stale, not as a match at host grain', () => {
        const hostOnly = child('FEATURE#x', [{ universalKey: 'PRESENCE#f', fromHostPresence: { host: 'ROOM#a' } as any, cover: REMAINDER }])
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
    const carve = { universalKey: 'PRESENCE#carve', cover: { members: [] as { host: string; presence: string }[] } }
    it('rewrites only remainder-free covers that disagree with the pointers, and reads clean after', () => {
        const whole = room(['FEATURE#x'], [{ universalKey: 'PRESENCE#root', cover: REMAINDER }, carve])
        const graphs = [child('FEATURE#x', [point('PRESENCE#f', 'PRESENCE#carve')])]
        expect(coverRebuildsFor(whole, lookup(graphs))).toEqual([{ bindingId: 'PRESENCE#carve', entries: [{ host: 'FEATURE#x', presence: 'PRESENCE#f' }] }])
        const healed = room(['FEATURE#x'], [whole.presenceNodes[0], { ...carve, cover: { members: [{ host: 'FEATURE#x', presence: 'PRESENCE#f' }] } }])
        expect(coverRebuildsFor(healed, lookup(graphs))).toEqual([])
        expect(classifyPresenceCoverDrift(healed, lookup(graphs)).findings).toEqual([])
    })
})
