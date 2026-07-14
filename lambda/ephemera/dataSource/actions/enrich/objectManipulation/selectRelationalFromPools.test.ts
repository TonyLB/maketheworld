import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { T_JOINT_ABS, T_JOINT_ABS_UNARY, T_JOINT_MARGIN } from './embeddingMatch/thresholds'
import { testPositionGraph } from '../../../positions/positionGraph/testFixtures'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { selectRelationalFromPools } from './selectRelationalFromPools'
import type { SpanCandidatePool } from './spanResolution'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const mopId = 'OBJECT#Mop' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const ghostId = 'OBJECT#Ghost' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId

const catalog: ObjectManipulationCatalogEntry[] = [
    { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
    { objectId: mopId, normalizedShortName: 'mop', catalogScope: 'room' },
    { objectId: tableId, normalizedShortName: 'table', catalogScope: 'room' },
]

const roomGraph = testPositionGraph(roomId, {
    nodes: [
        { tag: 'Object' as const, universalKey: broomId },
        { tag: 'Object' as const, universalKey: mopId },
        { tag: 'Object' as const, universalKey: tableId },
    ],
})

const subjectPool = (
    candidates: SpanCandidatePool['candidates']
): SpanCandidatePool => ({
    span: 'sweeping tool',
    candidates,
})

const targetPoolExact: SpanCandidatePool = {
    span: 'table',
    candidates: [
        {
            id: tableId,
            label: 'table',
            jointRelevance: 1,
            sourceTags: ['exact'],
            locus: { kind: 'room' },
        },
    ],
}

describe('selectRelationalFromPools', () => {
    it('auto-resolves high-confidence subject/target pair', () => {
        const result = selectRelationalFromPools({
            subjectPool: subjectPool([
                {
                    id: broomId,
                    label: 'broom',
                    jointRelevance: 1,
                    sourceTags: ['exact'],
                    locus: { kind: 'room' },
                },
            ]),
            targetPool: targetPoolExact,
            operationKind: 'establishRelation',
            relation: { type: 'enum', kind: 'On' },
            catalog,
            dryRunContext: { positionGraph: roomGraph },
        })

        expect(result).toEqual({
            type: 'resolved',
            subjectId: broomId,
            targetId: tableId,
            operationKind: 'establishRelation',
            relation: { type: 'enum', kind: 'On' },
        })
    })

    it('thin margin among legal subject alternatives -> consult', () => {
        const result = selectRelationalFromPools({
            subjectPool: subjectPool([
                {
                    id: broomId,
                    label: 'broom',
                    jointRelevance: T_JOINT_ABS + 0.05,
                    marginToRunnerUp: T_JOINT_MARGIN - 0.01,
                    sourceTags: ['lexical', 'embedding'],
                    locus: { kind: 'room' },
                },
                {
                    id: mopId,
                    label: 'mop',
                    jointRelevance: T_JOINT_ABS + 0.02,
                    sourceTags: ['lexical', 'embedding'],
                    locus: { kind: 'room' },
                },
            ]),
            targetPool: targetPoolExact,
            operationKind: 'establishRelation',
            relation: { type: 'enum', kind: 'On' },
            catalog,
            dryRunContext: { positionGraph: roomGraph },
        })

        expect(result.type).toBe('consult')
        if (result.type === 'consult') {
            expect(result.alternatives).toHaveLength(2)
            expect(result.alternatives.map((a) => a.objectId)).toEqual([broomId, mopId])
            expect(result.alternatives[0]!.proposedCommand).toBe('put the broom on the table')
            expect(result.alternatives[1]!.proposedCommand).toBe('put the mop on the table')
        }
    })

    it('grey-band unfit head -> abstain', () => {
        const result = selectRelationalFromPools({
            subjectPool: subjectPool([
                {
                    id: broomId,
                    label: 'broom',
                    jointRelevance: T_JOINT_ABS_UNARY - 0.05,
                    sourceTags: ['embedding'],
                    locus: { kind: 'room' },
                },
            ]),
            targetPool: targetPoolExact,
            operationKind: 'establishRelation',
            relation: { type: 'enum', kind: 'On' },
            catalog,
            dryRunContext: { positionGraph: roomGraph },
        })

        expect(result).toEqual({
            type: 'abstain',
            reason: objectManipulationErrorMessages.noMatch,
        })
    })

    it('existence guard rejects hallucinated subject id', () => {
        const result = selectRelationalFromPools({
            subjectPool: subjectPool([
                {
                    id: ghostId,
                    label: 'ghost',
                    jointRelevance: 1,
                    sourceTags: ['exact'],
                    locus: { kind: 'room' },
                },
            ]),
            targetPool: targetPoolExact,
            operationKind: 'establishRelation',
            relation: { type: 'enum', kind: 'On' },
            catalog,
            dryRunContext: {
                positionGraph: testPositionGraph(roomId, {
                    nodes: [
                        { tag: 'Object' as const, universalKey: ghostId },
                        { tag: 'Object' as const, universalKey: tableId },
                    ],
                }),
            },
        })

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.noMatch,
        })
    })

    it('same-id only pools -> sameSubjectAndTarget error', () => {
        const broomOnly: SpanCandidatePool = {
            span: 'broom',
            candidates: [
                {
                    id: broomId,
                    label: 'broom',
                    jointRelevance: 1,
                    sourceTags: ['exact'],
                    locus: { kind: 'room' },
                },
            ],
        }
        expect(selectRelationalFromPools({
            subjectPool: broomOnly,
            targetPool: broomOnly,
            operationKind: 'establishRelation',
            relation: { type: 'enum', kind: 'On' },
            catalog,
            dryRunContext: { positionGraph: roomGraph },
        })).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.sameSubjectAndTarget,
        })
    })

    it('resolves a dissolveRelation against an existing Custom edge via the sandbox-mediated dry run', () => {
        const graphWithCustomEdge = testPositionGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: broomId },
                { tag: 'Object' as const, universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: broomId, to: tableId, kind: 'Custom', relationLabel: 'wedged against' }],
        })

        const result = selectRelationalFromPools({
            subjectPool: subjectPool([
                {
                    id: broomId,
                    label: 'broom',
                    jointRelevance: 1,
                    sourceTags: ['exact'],
                    locus: { kind: 'room' },
                },
            ]),
            targetPool: targetPoolExact,
            operationKind: 'dissolveRelation',
            relation: { type: 'custom', kind: 'Custom', relationLabel: 'wedged against' },
            catalog,
            dryRunContext: { positionGraph: graphWithCustomEdge },
        })

        expect(result).toEqual({
            type: 'resolved',
            subjectId: broomId,
            targetId: tableId,
            operationKind: 'dissolveRelation',
            relation: { type: 'custom', kind: 'Custom', relationLabel: 'wedged against' },
        })
    })

    it('does not leak sandbox state mutations from dry-run probes on non-selected candidates', () => {
        const edgesBefore = roomGraph.relationalEdges

        selectRelationalFromPools({
            subjectPool: subjectPool([
                {
                    id: broomId,
                    label: 'broom',
                    jointRelevance: T_JOINT_ABS + 0.05,
                    marginToRunnerUp: T_JOINT_MARGIN - 0.01,
                    sourceTags: ['lexical', 'embedding'],
                    locus: { kind: 'room' },
                },
                {
                    id: mopId,
                    label: 'mop',
                    jointRelevance: T_JOINT_ABS + 0.02,
                    sourceTags: ['lexical', 'embedding'],
                    locus: { kind: 'room' },
                },
            ]),
            targetPool: targetPoolExact,
            operationKind: 'establishRelation',
            relation: { type: 'enum', kind: 'On' },
            catalog,
            dryRunContext: { positionGraph: roomGraph },
        })

        expect(roomGraph.relationalEdges).toEqual(edgesBefore)
    })

    it('illegal dry-run (not on graph) -> error', () => {
        const emptyGraph = testPositionGraph(roomId, { nodes: [] })
        expect(selectRelationalFromPools({
            subjectPool: subjectPool([
                {
                    id: broomId,
                    label: 'broom',
                    jointRelevance: 1,
                    sourceTags: ['exact'],
                    locus: { kind: 'room' },
                },
            ]),
            targetPool: targetPoolExact,
            operationKind: 'establishRelation',
            relation: { type: 'enum', kind: 'On' },
            catalog,
            dryRunContext: { positionGraph: emptyGraph },
        })).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.notOnHostGraph,
        })
    })
})
