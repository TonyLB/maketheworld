import { connectionDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"

export type RemoveCharacterAdjacencyResult = {
    sessionsAfterRemoval: string[]
}

export const atomicallyRemoveCharacterAdjacency = async (
    sessionId: string,
    characterId: EphemeraCharacterId
): Promise<RemoveCharacterAdjacencyResult> => {
    const result = await exponentialBackoffWrapper(async () => {
        let sessionsAfterRemoval: string[] = []
        await connectionDB.transactWrite([
            {
                Delete: {
                    ConnectionId: `SESSION#${sessionId}`,
                    DataCategory: characterId
                }
            },
            {
                Update: {
                    Key: {
                        ConnectionId: characterId,
                        DataCategory: 'Meta::Character'
                    },
                    updateKeys: ['sessions'],
                    updateReducer: (draft) => {
                        draft.sessions = draft.sessions.filter((value) => (value !== sessionId))
                    },
                    successCallback: ({ sessions = [] }) => {
                        sessionsAfterRemoval = sessions
                    },
                    deleteCondition: ({ sessions = [] }) => (sessions.length === 0),
                }
            }
        ])
        return { sessionsAfterRemoval }
    }, { retryErrors: ['TransactionCanceledException']})
    return result ?? { sessionsAfterRemoval: [] }
}

export const disconnect = async (connectionId: string): Promise<void> => {
    //
    // TODO: Figure out whether a forced disconnet invalidates any cached values
    //

    const ConnectionId = `CONNECTION#${connectionId}`
    await Promise.all([
        connectionDB.deleteItem({
            ConnectionId,
            DataCategory: 'Meta::Connection'
        })
    ])
}

export default disconnect
