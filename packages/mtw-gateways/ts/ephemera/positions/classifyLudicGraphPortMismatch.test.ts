import { describe, it, expect } from '@jest/globals'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphPort, HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { classifyLudicGraphPortMismatch } from './classifyLudicGraphPortMismatch'

const HOST_ID = 'OBJECT#Rope' as EphemeraObjectId
const REFERRER_ID = 'ROOM#Kitchen' as EphemeraRoomId
const PORT_ID = 'abcd123'

const port = (overrides: Partial<EphemeraLudicGraphPort> = {}): EphemeraLudicGraphPort => ({
    portId: PORT_ID,
    fromHostId: REFERRER_ID,
    kind: 'Present',
    ...overrides,
})

// A well-formed referrer graph holding the given crossing edges into `OBJECT#Rope`'s port.
const referrerGraph = (edges: { kind: HostRelationalEdgeKind; relationLabel?: string; portId?: string }[]) => ({
    rootId: REFERRER_ID,
    nodes: [
        { tag: 'Room', universalKey: REFERRER_ID },
        { tag: 'Object', universalKey: HOST_ID },
    ],
    edges: edges.map(({ kind, relationLabel, portId }) => ({
        tag: 'Relational' as const,
        from: REFERRER_ID,
        to: { owner: HOST_ID, port: portId ?? PORT_ID },
        kind,
        ...(relationLabel === undefined ? {} : { relationLabel }),
    })),
    ports: [],
})

describe('classifyLudicGraphPortMismatch', () => {
    describe('agreement', () => {
        it.each(['On', 'Under', 'Against', 'In', 'PartOf', 'Present'] as HostRelationalEdgeKind[])(
            'reports no mismatch when a label-free port agrees with the referring edge (%s)',
            (kind) => {
                expect(classifyLudicGraphPortMismatch({
                    hostId: HOST_ID,
                    port: port({ kind }),
                    referrerLudicGraph: referrerGraph([{ kind }]),
                })).toEqual({ mismatch: false })
            }
        )

        it('reports no mismatch when a Custom port agrees on both kind and label', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'Custom', exteriorRelationLabel: 'threads into' }),
                referrerLudicGraph: referrerGraph([{ kind: 'Custom', relationLabel: 'threads into' }]),
            })).toEqual({ mismatch: false })
        })

        it('treats a label absent on both sides as agreement, not as two unknowns', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'On' }),
                referrerLudicGraph: referrerGraph([{ kind: 'On' }]),
            })).toEqual({ mismatch: false })
        })

        it('reports no mismatch when the same edge is listed twice (a fan that agrees with itself)', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'Present' }),
                referrerLudicGraph: referrerGraph([{ kind: 'Present' }, { kind: 'Present' }]),
            })).toEqual({ mismatch: false })
        })
    })

    describe('disagreement with a named referrer', () => {
        it('reports a kind mismatch and corrects toward the exterior edge', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'Present' }),
                referrerLudicGraph: referrerGraph([{ kind: 'On' }]),
            })).toEqual({ mismatch: true, correction: { kind: 'On' } })
        })

        it('reports a label mismatch on Custom and corrects toward the exterior label', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'Custom', exteriorRelationLabel: 'threads into' }),
                referrerLudicGraph: referrerGraph([{ kind: 'Custom', relationLabel: 'is lashed to' }]),
            })).toEqual({ mismatch: true, correction: { kind: 'Custom', exteriorRelationLabel: 'is lashed to' } })
        })

        it('reports a mismatch when the port records a label the exterior edge does not carry', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'On', exteriorRelationLabel: 'leftover' }),
                referrerLudicGraph: referrerGraph([{ kind: 'On' }]),
            })).toEqual({ mismatch: true, correction: { kind: 'On' } })
        })

        it('reports a mismatch when the exterior edge carries a label the port does not', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'On' }),
                referrerLudicGraph: referrerGraph([{ kind: 'On', relationLabel: 'balanced across' }]),
            })).toEqual({ mismatch: true, correction: { kind: 'On', exteriorRelationLabel: 'balanced across' } })
        })

        it('matches a crossing edge whichever terminal holds the port address', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'Present' }),
                referrerLudicGraph: {
                    ...referrerGraph([]),
                    edges: [{ tag: 'Relational' as const, from: { owner: HOST_ID, port: PORT_ID }, to: REFERRER_ID, kind: 'On' as const }],
                },
            })).toEqual({ mismatch: true, correction: { kind: 'On' } })
        })

        it('reports a split exterior fan with no correction --- broken exteriorly, not repairable here', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'On' }),
                referrerLudicGraph: referrerGraph([{ kind: 'On' }, { kind: 'Under' }]),
            })).toEqual({ mismatch: true })
        })
    })

    describe('gated: no named referrer edge is not a finding (LD-18, LP4i\'s original reason)', () => {
        it('reports no mismatch when the referrer graph holds no edge into this port', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'Present' }),
                referrerLudicGraph: referrerGraph([]),
            })).toEqual({ mismatch: false })
        })

        it('reports no mismatch when the referrer graph is absent', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'Present' }),
                referrerLudicGraph: undefined,
            })).toEqual({ mismatch: false })
        })

        it('reports no mismatch when the referrer graph fails the shape guard (that is the structure sweep\'s finding)', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'Present' }),
                referrerLudicGraph: { rootId: REFERRER_ID, nodes: [{ tag: 'Room', universalKey: REFERRER_ID }] },
            })).toEqual({ mismatch: false })
        })

        it('reports no mismatch when the referrer edge names the same owner but a different port', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'Present' }),
                referrerLudicGraph: referrerGraph([{ kind: 'On', portId: 'someOtherPort' }]),
            })).toEqual({ mismatch: false })
        })

        it('reports no mismatch when the referrer edge names the owner unqualified (no port address)', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'Present' }),
                referrerLudicGraph: {
                    ...referrerGraph([]),
                    edges: [{ tag: 'Relational' as const, from: REFERRER_ID, to: HOST_ID, kind: 'On' as const }],
                },
            })).toEqual({ mismatch: false })
        })
    })
})
