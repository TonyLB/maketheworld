// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { connectionDB } from "@tonylb/mtw-utilities/ts/dynamoDB"

export const handler = async (event: any) => {

    if (event.message === 'dropConnection') {
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
    if (event.message === 'checkSession') {
        const epochTime = Date.now()
        const { sessionId } = event
        const { shouldDrop } = (await connectionDB.optimisticUpdate<{ connections: string[]; dropAfter?: number; shouldDrop?: string }>({
            Key: {
                ConnectionId: `SESSION#${sessionId}`,
                DataCategory: 'Meta::Session'
            },
            updateKeys: ['connections', 'dropAfter', 'shouldDrop'],
            updateReducer: (draft) => {
                console.log(`epochTime: ${epochTime}`)
                console.log(`draft: ${JSON.stringify(draft, null, 4)}`)
                if (typeof draft.dropAfter === 'number' && draft.dropAfter < epochTime) {
                    draft.shouldDrop = 'Yes'
                }
            },
            deleteCondition: ({ shouldDrop }) => (Boolean(shouldDrop))
        }) || { shouldDrop: 'Yes' })
        return
    }
    throw new Error('Invalid parameters')
}