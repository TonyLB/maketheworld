import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { collapseUnarySpanPools } from './unaryCollapse'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { SpanCandidatePool } from './spanResolution'
import { T_JOINT_ABS, T_JOINT_MARGIN } from './embeddingMatch/thresholds'

const broomId = 'OBJECT#Broom' as EphemeraObjectId

const exactPool = (scope: 'room' | 'held' = 'room'): SpanCandidatePool => ({
    span: 'broom',
    candidates: [{
        id: broomId,
        label: 'broom',
        jointRelevance: 1,
        marginToRunnerUp: 0,
        sourceTags: ['exact'],
        locus: scope === 'held' ? { kind: 'heldByActor' } : { kind: 'room' },
    }],
})

describe('collapseUnarySpanPools', () => {
    it('returns single resolved object from exact pool', () => {
        expect(collapseUnarySpanPools([exactPool()])).toEqual({
            type: 'resolved',
            objectId: broomId,
            catalogScope: 'room',
        })
    })

    it('returns held catalog scope from locus', () => {
        expect(collapseUnarySpanPools([exactPool('held')])).toEqual({
            type: 'resolved',
            objectId: broomId,
            catalogScope: 'held',
        })
    })

    it('returns error when pool cannot auto-resolve', () => {
        const pool: SpanCandidatePool = {
            span: 'sword',
            candidates: [{
                id: broomId,
                label: 'broom',
                jointRelevance: 0.1,
                marginToRunnerUp: 0,
                sourceTags: ['lexical'],
                locus: { kind: 'room' },
            }],
        }
        const result = collapseUnarySpanPools([pool])
        expect(result.type).toBe('error')
    })

    it('returns error when multiple span pools', () => {
        const result = collapseUnarySpanPools([exactPool(), exactPool()])
        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.ambiguousMatch,
        })
    })

    it('resolves high-confidence joint pool', () => {
        const pool: SpanCandidatePool = {
            span: 'sweeping tool',
            candidates: [{
                id: broomId,
                label: 'broom',
                jointRelevance: T_JOINT_ABS + 0.1,
                marginToRunnerUp: T_JOINT_MARGIN + 0.01,
                sourceTags: ['lexical', 'embedding'],
                locus: { kind: 'room' },
            }],
        }
        expect(collapseUnarySpanPools([pool])).toEqual({
            type: 'resolved',
            objectId: broomId,
            catalogScope: 'room',
        })
    })
})
