import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import cacheDB, { LastSyncType, makeMessageDeltaPk } from '../../cacheDB'
import {
    Message,
    PerceptionMessage,
    CharacterSpeech,
    CharacterNarration,
    OutOfCharacterMessage
} from '@tonylb/mtw-interfaces/ts/messages'

type CharacterLineMessage = CharacterSpeech | CharacterNarration | OutOfCharacterMessage
import { EphemeraClientMessagePublishMessages } from '@tonylb/mtw-interfaces/ts/ephemera'
import { unique } from '../../lib/lists'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import binarySearch from './binarySearch'
import type { MessageAggregatesState, MessagesSliceState } from './baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { defaultComponentFromTag } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { splitType } from '@tonylb/mtw-utilities/ts/types'

// Enhanced message type with parsed WML
type EnhancedMessage = Message | (PerceptionMessage & { parsedWML: StandardForm })

/** Ephemera historically published `Name`; client `CharacterSpeech` uses `DisplayName`. */
export const normalizeCharacterMessageDisplayName = (message: Message): Message => {
    switch (message.DisplayProtocol) {
        case 'SayMessage':
        case 'NarrateMessage':
        case 'OOCMessage': {
            const m = message as CharacterLineMessage & { Name?: string }
            if (m.DisplayName === undefined && typeof m.Name === 'string') {
                const { Name: _legacy, ...rest } = m
                return { ...rest, DisplayName: m.Name } as Message
            }
            return message
        }
        default:
            return message
    }
}

const initialState: MessagesSliceState = {
    history: {},
    aggregates: {},
    presentation: {}
}

const mergeMessageIdAggregate = (
    aggregates: MessageAggregatesState,
    target: EphemeraCharacterId,
    messageId: string,
    createdTime: number
) => {
    if (!aggregates[target]) {
        aggregates[target] = {}
    }
    const prev = aggregates[target][messageId]
    if (!prev) {
        aggregates[target][messageId] = {
            earliestCreatedTime: createdTime,
            latestCreatedTime: createdTime
        }
    } else {
        aggregates[target][messageId] = {
            earliestCreatedTime: Math.min(prev.earliestCreatedTime, createdTime),
            latestCreatedTime: Math.max(prev.latestCreatedTime, createdTime)
        }
    }
}

/**
 * Presentation = "alternate timeline" transcript
 *
 * Real `history` keeps every revision. For the main UI we want one bubble per logical
 * `MessageId` whose text is the latest revision, while the bubble stays where the line
 * *first* mattered in the stream. Imagine a fictional log where each line was posted
 * once, at first-send time, already in its final form (no later edits).
 *
 * The wire `Message` type does not have a separate field for "sort position vs payload
 * revision time", so we deliberately overload `Message.CreatedTime` on rows stored only
 * in `presentation`: it is the sort key for this fictional transcript (matches
 * `earliestCreatedTime` for that id), not the server timestamp of the revision whose
 * body we are showing (that is `latestCreatedTime` when it differs). Payload fields
 * such as `Message` come from the latest revision when we have applied one.
 */
const toPresentationRow = (
    message: EnhancedMessage,
    transcriptPositionTime: number
): EnhancedMessage => ({
    ...message,
    CreatedTime: transcriptPositionTime
})

/**
 * When the ingested row is the latest revision for its `MessageId`, upsert into
 * `presentation` sorted by `(CreatedTime, MessageId)` using the same comparator as
 * `history` — but `CreatedTime` on stored rows is `earliestCreatedTime` (see above).
 *
 * @param priorEarliestCreatedTime — aggregate `earliestCreatedTime` **before** the merge
 *   that accompanied this ingest (only passed from the new-insert path). New history rows
 *   can only move `earliest` backward; the old presentation row sits at
 *   `(priorEarliestCreatedTime, MessageId)` and can be removed with `binarySearch` in O(log n).
 */
const applyPresentationIfLatest = (
    state: MessagesSliceState,
    target: EphemeraCharacterId,
    message: EnhancedMessage,
    priorEarliestCreatedTime?: number
) => {
    const agg = state.aggregates[target]?.[message.MessageId]
    if (!agg) {
        return
    }
    if (message.CreatedTime !== agg.latestCreatedTime) {
        return
    }
    const row = toPresentationRow(message, agg.earliestCreatedTime)
    if (!state.presentation[target]) {
        state.presentation[target] = []
    }
    const pres = state.presentation[target]
    if (
        priorEarliestCreatedTime !== undefined &&
        priorEarliestCreatedTime !== agg.earliestCreatedTime
    ) {
        const { exactMatch: atPriorKey, index: priorIdx } = binarySearch(
            pres,
            priorEarliestCreatedTime,
            row.MessageId
        )
        if (atPriorKey) {
            pres.splice(priorIdx, 1)
        }
    }
    const { exactMatch, index } = binarySearch(pres, row.CreatedTime, row.MessageId)
    if (exactMatch) {
        pres[index] = row
        return
    }
    pres.splice(index, 0, row)
}

/**
 * After a new row is inserted into `history`, the ingested payload may be an older
 * revision; presentation must always reflect the **latest** body and **earliest**
 * transcript position, so we re-resolve the canonical row from `history` + aggregates.
 */
const refreshPresentationFromLatestHistory = (
    state: MessagesSliceState,
    target: EphemeraCharacterId,
    messageId: string,
    priorEarliestCreatedTime?: number
) => {
    const agg = state.aggregates[target]?.[messageId]
    if (!agg) {
        return
    }
    const hist = state.history[target]
    const { exactMatch, index } = binarySearch(hist, agg.latestCreatedTime, messageId)
    if (exactMatch) {
        applyPresentationIfLatest(state, target, hist[index], priorEarliestCreatedTime)
    }
}

const messagesSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        receiveMessages(state, action: PayloadAction<EnhancedMessage[]>) {
            action.payload.forEach((rawMessage) => {
                const message = processPerceptionMessage(
                    normalizeCharacterMessageDisplayName(rawMessage as Message) as Message
                )

                if (!message.Target) {
                    return
                }

                const target = message.Target as EphemeraCharacterId

                if (state.history[target]) {
                    const { exactMatch, index } = binarySearch(
                        state.history[target],
                        message.CreatedTime,
                        message.MessageId
                    )
                    if (exactMatch) {
                        state.history[target][index] = message
                        applyPresentationIfLatest(state, target, message)
                    } else {
                        const priorEarliest =
                            state.aggregates[target]?.[message.MessageId]?.earliestCreatedTime
                        if (index >= state.history[target].length) {
                            state.history[target].push(message)
                        } else {
                            state.history[target].splice(index, 0, message)
                        }
                        mergeMessageIdAggregate(state.aggregates, target, message.MessageId, message.CreatedTime)
                        refreshPresentationFromLatestHistory(
                            state,
                            target,
                            message.MessageId,
                            priorEarliest
                        )
                    }
                } else {
                    const priorEarliest =
                        state.aggregates[target]?.[message.MessageId]?.earliestCreatedTime
                    state.history[target] = [message]
                    mergeMessageIdAggregate(state.aggregates, target, message.MessageId, message.CreatedTime)
                    refreshPresentationFromLatestHistory(state, target, message.MessageId, priorEarliest)
                }
            })
        },
        clear(state) {
            state.history = {}
            state.aggregates = {}
            state.presentation = {}
        }
    }
})

export const { receiveMessages, clear } = messagesSlice.actions

// Helper function to process PerceptionMessage with WML parsing
const processPerceptionMessage = (message: Message): EnhancedMessage => {
    if (message.DisplayProtocol === 'PerceptionMessage') {
        try {
            const standardForm = new StandardForm(message.wmlContent, { standardizeMode: 'ephemeraWire' })
            return {
                ...message,
                parsedWML: standardForm
            }
        } catch (error) {
            console.warn('Failed to parse WML content for PerceptionMessage:', error)
            // Create a fallback StandardForm to prevent perpetual loading state
            const componentUUID = message.metaData.componentUUID
            const [upperTag] = splitType(componentUUID)
            const tag = `${upperTag[0].toUpperCase()}${upperTag.slice(1).toLowerCase()}`
            
            // Create a proper fallback StandardForm with the correct component type
            const fallbackForm = new StandardForm('fallback')
            const defaultData = defaultComponentFromTag(tag as any, 'fallback', componentUUID)
            const { component: fallbackComponent } = standardComponentFactory(defaultData)
            
            if (fallbackComponent) {
                fallbackForm._components = [fallbackComponent]
            }
            
            return {
                ...message,
                parsedWML: fallbackForm
            }
        }
    }
    return message
}

export const cacheMessages = (payload: EphemeraClientMessagePublishMessages) => async (dispatch: any) => {
    //
    // Update LastSync data, and push messages to cacheDB
    //
    const { messages, LastSync } = payload
    
    // Store original messages in cacheDB (without parsedWML)
    const lastSyncUpdateTargets = unique(messages.map(({ Target }) => (Target))) as EphemeraCharacterId[]
    const updateLastSync = LastSync
        ? Promise.all(lastSyncUpdateTargets.map((CharacterId) => (cacheDB.characterSync
            .where('CharacterId').equals(CharacterId)
            .modify((storedLastSync) => { storedLastSync.lastSync = Math.max(LastSync ?? 0, storedLastSync.lastSync) })
            .then((update) => {
                if (!update) {
                    cacheDB.characterSync.put({ CharacterId, lastSync: LastSync ?? 0 })
                }
            })
        )))
        : Promise.resolve({})
    const messagesForCache = messages.map((message) => {
        const normalized = normalizeCharacterMessageDisplayName(message)
        return {
            ...normalized,
            deltaPk: makeMessageDeltaPk(normalized)
        }
    })
    await Promise.all([
        updateLastSync,
        cacheDB.messages.bulkPut(messagesForCache)
    ])

    //
    // Push processed messages to Redux
    //
    const processedMessages = messages.map((m) =>
        processPerceptionMessage(normalizeCharacterMessageDisplayName(m))
    )
    dispatch(receiveMessages(processedMessages))
}

export {
    getMessages,
    getPresentation,
    getMessagesByRoom
} from './selectors'

export default messagesSlice.reducer
