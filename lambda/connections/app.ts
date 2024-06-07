// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { connectionDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/ts/errors"
import { atomicallyRemoveCharacterAdjacency, disconnect } from './disconnect'
import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"

export const handler = async (event: any) => {

    const { connectionId, routeKey } = event.requestContext || {}

    if (routeKey === '$disconnect') {
        console.log(`Disconnecting ${connectionId}`)
        await disconnect(connectionId)
    }
    else if (event.message === 'dropConnection') {
        const epochTime = Date.now()
        const { sessionId, connectionId } = event
        const { dropAfter } = (await connectionDB.optimisticUpdate<{ dropAfter?: number }>({
            Key: {
                ConnectionId: `SESSION#${sessionId}`,
                DataCategory: 'Meta::Session'
            },
            updateKeys: ['connections', 'dropAfter'],
            updateReducer: (draft: { connections?: string[]; dropAfter?: number }) => {
                if (typeof draft.connections === 'undefined') {
                    draft.connections = []
                    draft.dropAfter = epochTime + 4000
                }
                else {
                    draft.connections = draft.connections.filter((id) => (id !== connectionId))
                    if (draft.connections.length === 0) {
                        draft.dropAfter = epochTime + 4000
                    }
                    else {
                        draft.dropAfter = undefined
                    }
                }
            }
        }) || {})
        return { dropAfter }
    }
    else if (event.message === 'checkSession') {
        const epochTime = Date.now()
        const { sessionId } = event
        let shouldDrop = false
        await connectionDB.optimisticUpdate<{ connections: string[]; dropAfter?: number; shouldDrop?: string }>({
            Key: {
                ConnectionId: `SESSION#${sessionId}`,
                DataCategory: 'Meta::Session'
            },
            updateKeys: ['connections', 'dropAfter', 'shouldDrop'],
            updateReducer: (draft) => {
                if (typeof draft.dropAfter === 'number' && draft.dropAfter < epochTime && !(Array.isArray(draft.connections) && draft.connections.length > 0)) {
                    draft.shouldDrop = 'Yes'
                    shouldDrop = true
                }
            },
            deleteCondition: ({ shouldDrop }) => (Boolean(shouldDrop))
        })
        if (shouldDrop) {
            await asyncSuppressExceptions(async () => {
                await exponentialBackoffWrapper(async () => {
                    const characterQuery = await connectionDB.query<{ ConnectionId: string; DataCategory: EphemeraCharacterId }>({
                        Key: { ConnectionId: `SESSION#${sessionId}` },
                        ExpressionAttributeValues: {
                            ':dcPrefix': 'CHARACTER#'
                        },
                        KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
                        ProjectionFields: ['DataCategory']
                    })

                    await Promise.all(characterQuery.map(({ DataCategory }) => (atomicallyRemoveCharacterAdjacency(sessionId, DataCategory))))

                    await connectionDB.transactWrite([
                        {
                            Update: {
                                Key: {
                                    ConnectionId: 'Global',
                                    DataCategory: 'Connections'
                                },
                                updateKeys: ['sessions'],
                                updateReducer: (draft) => {
                                    if (typeof draft.sessions === 'undefined') {
                                        draft.sessions = {}
                                    }
                                    else {
                                        draft.sessions[sessionId] = undefined
                                    }
                                }
                            }
                        },
                        {
                            Update: {
                                Key: {
                                    ConnectionId: 'Library',
                                    DataCategory: 'Subscriptions'
                                },
                                updateKeys: ['SessionIds'],
                                updateReducer: (draft) => {
                                    draft.SessionIds = (draft.SessionIds ?? []).filter((value) => (value !== sessionId))
                                }
                            }
                        },
                        {
                            Update: {
                                Key: {
                                    ConnectionId: 'Map',
                                    DataCategory: 'Subscriptions'
                                },
                                updateKeys: ['SessionIds'],
                                updateReducer: (draft) => {
                                    draft.SessionIds = (draft.SessionIds ?? []).filter((value) => (value !== sessionId))
                                }
                            }
                        }
                    ])
                }, {
                    retryErrors: ['TransactionCanceledException']
                })
            })
        }
        return
    }
    throw new Error('Invalid parameters')
}