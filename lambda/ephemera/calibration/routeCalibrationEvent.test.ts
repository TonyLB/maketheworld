import {
    CALIBRATION_EVENT_TYPES,
    isCalibrationEventType,
    routeCalibrationEvent,
} from './routeCalibrationEvent'

jest.mock('./objectMatch/runAsymmetricIdentityLadder', () => {
    const actual = jest.requireActual('./objectMatch/runAsymmetricIdentityLadder')
    return {
        ...actual,
        runAsymmetricIdentityLadder: jest.fn(actual.runAsymmetricIdentityLadder),
    }
})

jest.mock('./objectMatch/runSemanticDistanceLadder', () => {
    const actual = jest.requireActual('./objectMatch/runSemanticDistanceLadder')
    return {
        ...actual,
        runSemanticDistanceLadder: jest.fn(actual.runSemanticDistanceLadder),
    }
})

jest.mock('./objectMatch/verifyRepeatBedrockEmbed', () => {
    const actual = jest.requireActual('./objectMatch/verifyRepeatBedrockEmbed')
    return {
        ...actual,
        verifyRepeatBedrockEmbed: jest.fn(actual.verifyRepeatBedrockEmbed),
    }
})

jest.mock('./objectMatch/runEmbeddingCalibration', () => {
    const actual = jest.requireActual('./objectMatch/runEmbeddingCalibration')
    return {
        ...actual,
        compareEmbeddingPair: jest.fn(actual.compareEmbeddingPair),
        runFullEmbeddingCalibration: jest.fn(actual.runFullEmbeddingCalibration),
        simulateIdentityCalibration: jest.fn(actual.simulateIdentityCalibration),
    }
})

import {
    compareEmbeddingPair,
    runFullEmbeddingCalibration,
    simulateIdentityCalibration,
} from './objectMatch/runEmbeddingCalibration'
import { verifyRepeatBedrockEmbed } from './objectMatch/verifyRepeatBedrockEmbed'
import { runAsymmetricIdentityLadder } from './objectMatch/runAsymmetricIdentityLadder'
import { runSemanticDistanceLadder } from './objectMatch/runSemanticDistanceLadder'

const mockedCompare = compareEmbeddingPair as jest.MockedFunction<typeof compareEmbeddingPair>
const mockedCorpus = runFullEmbeddingCalibration as jest.MockedFunction<typeof runFullEmbeddingCalibration>
const mockedSimulate = simulateIdentityCalibration as jest.MockedFunction<typeof simulateIdentityCalibration>
const mockedVerifyRepeat = verifyRepeatBedrockEmbed as jest.MockedFunction<typeof verifyRepeatBedrockEmbed>
const mockedLadder = runSemanticDistanceLadder as jest.MockedFunction<typeof runSemanticDistanceLadder>
const mockedAsymmetricLadder = runAsymmetricIdentityLadder as jest.MockedFunction<
    typeof runAsymmetricIdentityLadder
>

describe('routeCalibrationEvent', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('exports all calibration event types', () => {
        expect(CALIBRATION_EVENT_TYPES).toEqual([
            'EmbeddingCompare',
            'EmbeddingCalibrationCorpus',
            'EmbeddingSimulateIdentity',
            'EmbeddingVerifyRepeat',
            'EmbeddingDistanceLadder',
            'EmbeddingAsymmetricLadder',
        ])
    })

    it('isCalibrationEventType narrows supported types', () => {
        expect(isCalibrationEventType('EmbeddingCompare')).toBe(true)
        expect(isCalibrationEventType('EmbeddingVerifyRepeat')).toBe(true)
        expect(isCalibrationEventType('Command')).toBe(false)
    })

    it('returns 400 for unknown event type', async () => {
        const response = await routeCalibrationEvent({ type: 'NotARealType' })
        expect(response.statusCode).toBe(400)
        expect(JSON.parse(response.body).supportedTypes).toEqual([...CALIBRATION_EVENT_TYPES])
    })

    it('dispatches EmbeddingCompare', async () => {
        mockedCompare.mockResolvedValue({
            left: 'broom',
            right: 'sweeping tool',
            leftNormalized: 'broom',
            rightNormalized: 'sweeping tool',
            similarity: 0.9,
            modelId: 'amazon.titan-embed-text-v2:0',
            dimensions: 256,
        })

        const response = await routeCalibrationEvent({
            type: 'EmbeddingCompare',
            left: 'broom',
            right: 'sweeping tool',
        })

        expect(response.statusCode).toBe(200)
        expect(JSON.parse(response.body).similarity).toBe(0.9)
        expect(mockedCompare).toHaveBeenCalledWith('broom', 'sweeping tool')
    })

    it('dispatches EmbeddingCalibrationCorpus', async () => {
        mockedCorpus.mockResolvedValue({
            metadata: {
                corpusId: 'embedding-identity-v1',
                modelId: 'amazon.titan-embed-text-v2:0',
                dimensions: 256,
                calibratedAt: '2026-01-01T00:00:00.000Z',
            },
            pairs: { cases: [], bucketSummaries: [] },
            identity: {
                cases: [],
                bucketSummaries: [],
                marginRatioComparison: {
                    absoluteGap: { min: 0, median: 0, max: 0, count: 0 },
                    ratio: { min: 0, median: 0, max: 0, count: 0 },
                    note: 'test',
                },
            },
        })

        const response = await routeCalibrationEvent({ type: 'EmbeddingCalibrationCorpus' })
        expect(response.statusCode).toBe(200)
        expect(mockedCorpus).toHaveBeenCalledWith(undefined)
    })

    it('dispatches EmbeddingSimulateIdentity', async () => {
        mockedSimulate.mockResolvedValue({
            span: 'sword',
            spanNormalized: 'sword',
            catalog: ['broom'],
            rankedScores: [],
            margin: null,
            ratio: null,
            decision: { type: 'Abstain', reason: 'below_floor' },
            thresholds: { T_ABS: 0.85, T_ABS_UNARY: 0.92, T_MARGIN: 0.08 },
        })

        const response = await routeCalibrationEvent({
            type: 'EmbeddingSimulateIdentity',
            span: 'sword',
            catalog: ['broom'],
        })

        expect(response.statusCode).toBe(200)
        expect(mockedSimulate).toHaveBeenCalledWith({
            span: 'sword',
            catalog: ['broom'],
        })
    })

    it('returns 400 when EmbeddingCompare payload is invalid', async () => {
        const response = await routeCalibrationEvent({
            type: 'EmbeddingCompare',
            left: 1,
            right: 'broom',
        } as unknown as { type: string })
        expect(response.statusCode).toBe(400)
    })

    it('dispatches EmbeddingVerifyRepeat', async () => {
        mockedVerifyRepeat.mockResolvedValue({
            text: 'lantern',
            normalized: 'lantern',
            modelId: 'amazon.titan-embed-text-v2:0',
            bedrockInvokeCount: 2,
            sourceTextHash: 'abc',
            float32: { maxAbsDiff: 0, cosineSimilarity: 1 },
            quantized: { cosineSimilarity: 1, vectorsEqual: true },
            productionPath: {
                crossInvokeCosineSimilarity: 1,
                vectorsEqual: true,
            },
        })

        const response = await routeCalibrationEvent({
            type: 'EmbeddingVerifyRepeat',
            text: 'lantern',
        })

        expect(response.statusCode).toBe(200)
        expect(JSON.parse(response.body).quantized.vectorsEqual).toBe(true)
        expect(mockedVerifyRepeat).toHaveBeenCalledWith('lantern')
    })

    it('dispatches EmbeddingDistanceLadder', async () => {
        mockedLadder.mockResolvedValue({
            ladderId: 'semantic-distance-ladder-v1',
            modelId: 'amazon.titan-embed-text-v2:0',
            cases: [],
            sortedBySimilarity: [],
            tierSummaries: [],
            monotonicityViolations: [],
            note: 'test',
        })

        const response = await routeCalibrationEvent({ type: 'EmbeddingDistanceLadder' })
        expect(response.statusCode).toBe(200)
        expect(mockedLadder).toHaveBeenCalledWith(undefined)
    })

    it('dispatches EmbeddingAsymmetricLadder', async () => {
        mockedAsymmetricLadder.mockResolvedValue({
            ladderId: 'asymmetric-identity-ladder-v1',
            modelId: 'amazon.titan-embed-text-v2:0',
            composition: 'shortNamePlusDescription',
            cases: [],
            sortedBySimilarity: [],
            sortedByDelta: [],
            tierSummaries: [],
            monotonicityViolations: [],
            note: 'test',
        })

        const response = await routeCalibrationEvent({
            type: 'EmbeddingAsymmetricLadder',
            tier: 'identity-positive-paraphrase',
            composition: 'descriptionOnly',
        })
        expect(response.statusCode).toBe(200)
        expect(mockedAsymmetricLadder).toHaveBeenCalledWith({
            tier: 'identity-positive-paraphrase',
            composition: 'descriptionOnly',
        })
    })
})
