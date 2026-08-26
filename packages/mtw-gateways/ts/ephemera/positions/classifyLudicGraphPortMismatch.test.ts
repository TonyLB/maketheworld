import { describe, it, expect } from '@jest/globals'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphPort, HostRelationalEdgeKind, RelationalEdgeKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
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
// The edge spec takes `RelationalEdgeKindAndLabel` rather than a loose `kind` + optional label,
// so a case cannot describe an edge the stored type no longer admits --- notably a non-`Custom`
// kind carrying a `relationLabel`, which used to be constructible here and is now a type error.
const referrerGraph = (edges: (RelationalEdgeKindAndLabel & { portId?: string })[]) => ({
    rootId: REFERRER_ID,
    nodes: [
        { tag: 'Room', universalKey: REFERRER_ID },
        { tag: 'Object', universalKey: HOST_ID },
    ],
    edges: edges.map((edge) => ({
        tag: 'Relational' as const,
        from: REFERRER_ID,
        to: { owner: HOST_ID, port: edge.portId ?? PORT_ID },
        ...(edge.kind === 'Custom'
            ? { kind: 'Custom' as const, relationLabel: edge.relationLabel }
            : { kind: edge.kind }),
    })),
    ports: [],
})

describe('classifyLudicGraphPortMismatch', () => {
    describe('agreement', () => {
        it.each(['On', 'Under', 'Against', 'In', 'PartOf', 'Present'] as const)(
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

        // Rewritten with the type rather than made to pass: this case used to describe an `On`
        // edge carrying a `relationLabel`, which is no longer a representable stored edge (a label
        // belongs to `Custom`). A referrer graph holding one now fails the shape guard outright,
        // which is the structure sweep's finding and not this comparison's --- see the gated case
        // below. The behaviour under test survives intact on the kind that *can* carry a label:
        // the port records no label, the exterior edge has one, and the correction picks it up.
        it('reports a mismatch when the exterior edge carries a label the port does not', () => {
            expect(classifyLudicGraphPortMismatch({
                hostId: HOST_ID,
                port: port({ kind: 'On' }),
                referrerLudicGraph: referrerGraph([{ kind: 'Custom', relationLabel: 'balanced across' }]),
            })).toEqual({ mismatch: true, correction: { kind: 'Custom', exteriorRelationLabel: 'balanced across' } })
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
