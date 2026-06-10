import { AssetsDataSource } from './abstract'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { snsClient } from '../clients'
import messageBus from '../messageBus'

// Mock uuid so @tonylb/mtw-lambda-patterns resolves a defined v4 (avoids eventId=undefined in streamEvent)
jest.mock('uuid', () => ({ v4: () => 'test-uuid-assets' }))

// Mock the dependencies
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        putItem: jest.fn().mockResolvedValue(undefined),
        getItem: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue([]),
        optimisticUpdate: jest.fn().mockResolvedValue(undefined)
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
        publish: jest.fn(),
        subscribe: jest.fn()
    },
    send: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn()
}))

// Test types
type TestSnapshotPayload = {
    data: string;
    timestamp: number;
}

type TestUpdatePayload = {
    type: string;
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
                type: 'TestUpdate',
                action: 'created',
                data: 'test data'
            }

            await dataSource.streamEvent({
                update,
                streamKey: 'test-stream',
                header: { type: 'TestUpdate' }
            })

            // Verify DynamoDB storage
            expect(assetDB.putItem).toHaveBeenCalledWith(
                expect.objectContaining({
                    AssetId: 'STREAM#mtw.assets.test::test-stream',
                    DataCategory: expect.stringMatching(/^EVENT#/),
                    update
                })
            )

            // Verify messageBus message (header + getContent envelope)
            const sendCall = (messageBus.send as jest.Mock).mock.calls[0][0]
            expect(sendCall).toMatchObject({
                type: 'StreamingEvent',
                dataSourceKey: 'mtw.assets.test',
                streamKey: 'test-stream',
                header: expect.objectContaining({
                    dataSourceKey: 'mtw.assets.test',
                    streamKey: 'test-stream'
                })
            })
            expect(sendCall.getContent).toBeDefined()
            expect(await sendCall.getContent()).toEqual(expect.objectContaining(update))
        })

        it('should publish events to messageBus when outboundBusDelivery is publish', async () => {
            const publishDataSource = new AssetsDataSource({
                dataSourceKey: 'mtw.assets.test.publish',
                outboundBusDelivery: 'publish',
            })
            const update: TestUpdatePayload = {
                type: 'TestUpdate',
                action: 'created',
                data: 'test data',
            }

            await publishDataSource.streamEvent({
                update,
                streamKey: 'test-stream',
                header: { type: 'TestUpdate' },
            })

            expect(messageBus.publish).toHaveBeenCalled()
            expect(messageBus.send).not.toHaveBeenCalled()
        })
    })

    describe('generateSnapshot', () => {
        it('should call the provided snapshot content generator', async () => {
            const snapshot = await dataSource.generateSnapshot('test-stream')

            expect(snapshot).toEqual({
                data: 'snapshot for test-stream',
                timestamp: expect.any(Number),
                createdAt: expect.any(Number),
                replayAt: expect.any(Number),
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

            // Non-replayable data sources should throw an error when trying to get snapshots
            await expect(nonReplayableDataSource.getSnapshot('test-stream')).rejects.toThrow(
                'DataSource \'mtw.testNonReplayable\' is not replayable and does not support snapshots'
            )
        })
    })
})
