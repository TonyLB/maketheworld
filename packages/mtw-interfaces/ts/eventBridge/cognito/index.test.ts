import { CognitoEventSerializer, isCognitoEventUpdate, isNewPlayerEvent } from './index'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

const cognitoHeader = (type: string): StreamingEventHeader => ({
    dataSourceKey: 'mtw.cognito',
    streamKey: 'global',
    timestamp: 0,
    type
})

describe('CognitoEventSerializer', () => {
    const testEnv: DataSourceEnvironment = {
        fetch: jest.fn() as any
    }
    const serializer = new CognitoEventSerializer(testEnv)

    it('serializes and deserializes New Player', async () => {
        const event = {
            type: 'New Player' as const,
            player: 'alice'
        }
        const serialized = serializer.serialize({
            content: event,
            header: cognitoHeader('New Player')
        })
        expect(serialized).toEqual(event)

        const deserialized = await serializer.deserialize({
            content: serialized,
            header: cognitoHeader('New Player')
        })
        expect(deserialized).toEqual(event)
    })

    it('returns null for malformed New Player payload', async () => {
        const deserialized = await serializer.deserialize({
            content: { player: '' },
            header: cognitoHeader('New Player')
        })
        expect(deserialized).toBeNull()
    })

    it('throws on Snapshot serialization', () => {
        expect(() => serializer.serialize({
            content: {
                type: 'New Player',
                player: 'alice'
            },
            header: cognitoHeader('Snapshot')
        })).toThrow('CognitoEventSerializer does not support snapshot serialization')
    })
})

describe('cognito event guards', () => {
    it('validates New Player', () => {
        expect(isNewPlayerEvent({
            type: 'New Player',
            player: 'alice'
        })).toBe(true)
        expect(isNewPlayerEvent({
            type: 'New Player',
            player: ''
        })).toBe(false)
    })

    it('validates union update guard', () => {
        expect(isCognitoEventUpdate({
            type: 'New Player',
            player: 'alice'
        })).toBe(true)
        expect(isCognitoEventUpdate({
            type: 'Unknown Event',
            player: 'alice'
        })).toBe(false)
    })
})
