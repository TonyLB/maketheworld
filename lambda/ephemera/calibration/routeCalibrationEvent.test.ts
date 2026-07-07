import {
    CALIBRATION_EVENT_TYPES,
    isCalibrationEventType,
    routeCalibrationEvent,
} from './routeCalibrationEvent'

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

const mockedCompare = compareEmbeddingPair as jest.MockedFunction<typeof compareEmbeddingPair>
const mockedCorpus = runFullEmbeddingCalibration as jest.MockedFunction<typeof runFullEmbeddingCalibration>
const mockedSimulate = simulateIdentityCalibration as jest.MockedFunction<typeof simulateIdentityCalibration>

describe('routeCalibrationEvent', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('exports all calibration event types', () => {
        expect(CALIBRATION_EVENT_TYPES).toEqual([
            'EmbeddingCompare',
            'EmbeddingCalibrationCorpus',
            'EmbeddingSimulateIdentity',
        ])
    })

    it('isCalibrationEventType narrows supported types', () => {
        expect(isCalibrationEventType('EmbeddingCompare')).toBe(true)
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
})
