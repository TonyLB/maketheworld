import { AssetsDataSource } from './abstract'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { snsClient } from '../clients'
import messageBus from '../messageBus'

// Mock the dependencies
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        putItem: jest.fn(),
        getItem: jest.fn(),
        query: jest.fn(),
        optimisticUpdate: jest.fn()
    }
}))

jest.mock('@tonylb/mtw-utilities/ts/eventBridge', () => ({
    eventBridgeClient: {
        send: jest.fn()
    }
}))

jest.mock('../clients', () => ({
    snsClient: {
        send: jest.fn()
    }
}))

jest.mock('../messageBus', () => ({
    default: {
        send: jest.fn(),
        subscribe: jest.fn()
    },
    send: jest.fn(),
    subscribe: jest.fn()
}))

// Test types
type TestSnapshotPayload = {
    data: string;
    timestamp: number;
}

type TestUpdatePayload = {
    action: string;
    data: string;
}

describe('AssetsDataSource', () => {
    let dataSource: AssetsDataSource<TestSnapshotPayload, TestUpdatePayload>

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks()
        
        // Mock environment variables
        process.env.FEEDBACK_TOPIC = 'arn:aws:sns:us-east-1:123456789012:feedback-topic'
        
        dataSource = new AssetsDataSource({
            dataSourceKey: 'mtw.assets.test',
            snapshotContentGenerator: async (streamKey: string) => ({
                data: `snapshot for ${streamKey}`,
                timestamp: Date.now()
            })
        })
    })

    describe('constructor', () => {
        it('should initialize with correct configuration', () => {
            expect(dataSource.dataSourceKey).toBe('mtw.assets.test')
            expect(dataSource.primaryKeyName).toBe('AssetId')
            expect(dataSource.feedbackTopicArn).toBe('arn:aws:sns:us-east-1:123456789012:feedback-topic')
        })

        it('should pre-configure DynamoDB utilities', () => {
            expect(dataSource.dynamo).toBeDefined()
            expect(dataSource.dynamo.putItem).toBeDefined()
            expect(dataSource.dynamo.getItem).toBeDefined()
            expect(dataSource.dynamo.query).toBeDefined()
            expect(dataSource.dynamo.optimisticUpdate).toBeDefined()
        })

        it('should pre-configure SNS utilities', () => {
            expect(dataSource.sns).toBeDefined()
            expect(dataSource.sns.send).toBeDefined()
        })

        it('should pre-configure messageBus', () => {
            expect(dataSource.messageBus).toBeDefined()
        })
    })

    describe('streamEvent', () => {
        it('should publish events to EventBridge and store in DynamoDB', async () => {
            const update: TestUpdatePayload = {
                action: 'created',
                data: 'test data'
            }

            await dataSource.streamEvent({
                update,
                streamKey: 'test-stream',
                detailType: 'Test Event'
            })

            // Verify DynamoDB storage
            expect(assetDB.putItem).toHaveBeenCalledWith(
                expect.objectContaining({
                    AssetId: 'STREAM#mtw.assets.test::test-stream',
                    DataCategory: expect.stringMatching(/^EVENT#/),
                    update,
                    streamKey: 'test-stream'
                })
            )

            // Verify messageBus message
            expect(messageBus.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageType: 'StreamingEvent',
                    dataSourceKey: 'mtw.assets.test',
                    detailType: 'Test Event',
                    event: expect.objectContaining({
                        streamKey: 'test-stream',
                        update
                    })
                })
            )
        })
    })

    describe('generateSnapshot', () => {
        it('should call the provided snapshot content generator', async () => {
            const snapshot = await dataSource.generateSnapshot('test-stream')

            expect(snapshot).toEqual({
                data: 'snapshot for test-stream',
                timestamp: expect.any(Number),
                createdAt: expect.any(Number),
                expiresAt: expect.any(Number)
            })
        })
    })

    describe('non-replayable data source', () => {
        it('should work without snapshotContentGenerator', async () => {
            const nonReplayableDataSource = new AssetsDataSource({
                dataSourceKey: 'mtw.testNonReplayable',
                replayable: false
                // No snapshotContentGenerator provided
            })

            const snapshot = await nonReplayableDataSource.getSnapshot('test-stream')

            expect(snapshot).toEqual({
                streamKey: 'test-stream',
                timestamp: expect.any(Number)
            })
        })
    })
})
