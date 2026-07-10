import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { selectSingleSpanFromPool } from './selectSingleSpanFromPool'
import type { SpanCandidatePool } from './spanResolution'
import { T_JOINT_ABS, T_JOINT_ABS_UNARY, T_JOINT_MARGIN } from './embeddingMatch/thresholds'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId

const pool = (candidates: SpanCandidatePool['candidates']): SpanCandidatePool => ({
    span: 'test',
    candidates,
})

describe('selectSingleSpanFromPool', () => {
    it('auto-resolves unique exact candidate', () => {
        const outcome = selectSingleSpanFromPool(pool([{
            id: broomId,
            label: 'broom',
            jointRelevance: 1,
            sourceTags: ['exact'],
            locus: { kind: 'room' },
        }]))

        expect(outcome).toEqual({
            verdict: 'resolved',
            objectId: broomId,
            locus: { kind: 'room' },
        })
    })

    it('errors on multiple exact candidates', () => {
        const outcome = selectSingleSpanFromPool(pool([
            {
                id: broomId,
                label: 'broom',
                jointRelevance: 1,
                marginToRunnerUp: 0,
                sourceTags: ['exact'],
                locus: { kind: 'room' },
            },
            {
                id: anvilId,
                label: 'broom',
                jointRelevance: 1,
                sourceTags: ['exact'],
                locus: { kind: 'heldByActor' },
            },
        ]))

        expect(outcome).toEqual({
            verdict: 'error',
            reason: objectManipulationErrorMessages.ambiguousMatch,
        })
    })

    it('auto-resolves when joint relevance and margin pass thresholds', () => {
        const outcome = selectSingleSpanFromPool(pool([
            {
                id: broomId,
                label: 'broom',
                jointRelevance: T_JOINT_ABS + 0.05,
                marginToRunnerUp: T_JOINT_MARGIN + 0.01,
                sourceTags: ['lexical', 'embedding'],
                locus: { kind: 'room' },
            },
            {
                id: anvilId,
                label: 'anvil',
                jointRelevance: 0.1,
                sourceTags: ['lexical', 'embedding'],
                locus: { kind: 'room' },
            },
        ]))

        expect(outcome.verdict).toBe('resolved')
    })

    it('errors on thin margin when head passes absolute floor', () => {
        const outcome = selectSingleSpanFromPool(pool([
            {
                id: broomId,
                label: 'broom',
                jointRelevance: T_JOINT_ABS + 0.05,
                marginToRunnerUp: T_JOINT_MARGIN - 0.01,
                sourceTags: ['lexical', 'embedding'],
                locus: { kind: 'room' },
            },
            {
                id: anvilId,
                label: 'anvil',
                jointRelevance: T_JOINT_ABS,
                sourceTags: ['lexical', 'embedding'],
                locus: { kind: 'room' },
            },
        ]))

        expect(outcome).toEqual({
            verdict: 'error',
            reason: objectManipulationErrorMessages.ambiguousMatch,
        })
    })

    it('uses unary absolute floor for single-candidate pool', () => {
        const belowUnary = selectSingleSpanFromPool(pool([{
            id: broomId,
            label: 'broom',
            jointRelevance: T_JOINT_ABS_UNARY - 0.01,
            marginToRunnerUp: 0,
            sourceTags: ['lexical'],
            locus: { kind: 'room' },
        }]))
        expect(belowUnary.verdict).toBe('error')

        const aboveUnary = selectSingleSpanFromPool(pool([{
            id: broomId,
            label: 'broom',
            jointRelevance: T_JOINT_ABS_UNARY,
            marginToRunnerUp: 0,
            sourceTags: ['lexical'],
            locus: { kind: 'room' },
        }]))
        expect(aboveUnary.verdict).toBe('resolved')
    })

    it('errors on empty pool', () => {
        expect(selectSingleSpanFromPool(pool([]))).toEqual({
            verdict: 'error',
            reason: objectManipulationErrorMessages.noCatalog,
        })
    })
})
