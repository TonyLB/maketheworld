import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'

export type CognitoNewPlayerEvent = {
    type: 'New Player'
    player: string
}

export type CognitoEventUpdate = CognitoNewPlayerEvent

export type CognitoNewPlayerEventExternal = {
    type: 'New Player'
    player: string
}

export type CognitoEventExternal = CognitoNewPlayerEventExternal

export const isNewPlayerEvent = (event: any): event is CognitoNewPlayerEvent => (
    Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'New Player' &&
        typeof event.player === 'string' &&
        event.player.length > 0
    )
)

export const isCognitoEventUpdate = (event: unknown): event is CognitoEventUpdate => (
    isNewPlayerEvent(event)
)

export class CognitoEventSerializer implements DataSourceEventSerializer<CognitoEventUpdate, CognitoEventExternal> {
    constructor(private readonly env: DataSourceEnvironment) {
        void env
    }

    serialize(params: {
        content: CognitoEventUpdate
        header: StreamingEventHeader
    }): CognitoEventExternal {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            throw new Error('CognitoEventSerializer does not support snapshot serialization')
        }
        if (header.type === 'New Player' && isNewPlayerEvent(content)) {
            return {
                type: 'New Player',
                player: content.player
            }
        }
        throw new Error(`Unknown cognito event type: ${header.type}`)
    }

    async deserialize(params: {
        content: any
        header: StreamingEventHeader
    }): Promise<CognitoEventUpdate | null> {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            return null
        }
        if (header.type === 'New Player') {
            if (typeof content?.player !== 'string' || content.player.length === 0) {
                return null
            }
            return {
                type: 'New Player',
                player: content.player
            }
        }
        return null
    }
}
