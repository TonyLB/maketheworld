import { createSelector } from '@reduxjs/toolkit'
import { v4 as uuidv4 } from 'uuid'

import {
    Message,
    PerceptionMessage,
    isPerceptionRoomMetaData,
    resolvedPerceptionRoomChannel
} from '@tonylb/mtw-interfaces/ts/messages'
import { MessageState } from './baseClasses'
import { Selector } from '../../store'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import binarySearch from './binarySearch'
import { SchemaImportMapping } from '@tonylb/mtw-base/ts/schema/metaData'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

/** Label for transcript chips / recent visits: ephemera `<Render>` displayName, then component displayName / shortName. */
function perceptionMessageDisplayLabel(component: StandardComponent): string | undefined {
    if (component instanceof StandardRoom) {
        const render = component.render
        const dn = render?.displayName
        if (typeof dn === 'string' && dn.trim()) {
            return dn.trim()
        }
    }
    const displayName = (component as any).displayName
    const shortName = (component as any).shortName
    if (displayName?.plainString) {
        return displayName.plainString
    }
    if (shortName?.plainString) {
        return shortName.plainString
    }
    return undefined
}

// Helper function to check if a message is a room header
const isRoomHeader = (message: Message): message is PerceptionMessage => {
    if (message.DisplayProtocol === 'PerceptionMessage') {
        const perceptionMessage = message as PerceptionMessage
        return !!(perceptionMessage.metaData && isPerceptionRoomMetaData(perceptionMessage.metaData) && perceptionMessage.metaData.displayMode === 'header')
    }
    return false
}

// Helper function to extract room ID from a PerceptionMessage
const getRoomId = (message: PerceptionMessage): string => {
    if (message.metaData && isPerceptionRoomMetaData(message.metaData)) {
        return message.metaData.componentUUID
    }
    return 'ROOM#UNKNOWN'
}

const perceptionRoomChannel = (message: PerceptionMessage): 'render' | 'affordances' => {
    if (message.metaData && isPerceptionRoomMetaData(message.metaData)) {
        return resolvedPerceptionRoomChannel(message.metaData)
    }
    return 'render'
}

const isAffordanceRoomHeader = (message: PerceptionMessage): boolean =>
    isRoomHeader(message) && perceptionRoomChannel(message) === 'affordances'

const isRenderRoomHeader = (message: PerceptionMessage): boolean =>
    isRoomHeader(message) && perceptionRoomChannel(message) === 'render'

type RoomHeaderMessage = PerceptionMessage & { parsedWML?: StandardForm }

const takePendingAffordance = (
    pending: Record<string, RoomHeaderMessage>,
    roomId: string
): { affordance?: RoomHeaderMessage; nextPending: Record<string, RoomHeaderMessage> } => {
    const affordance = pending[roomId]
    if (!affordance) {
        return { nextPending: pending }
    }
    const nextPending = { ...pending }
    delete nextPending[roomId]
    return { affordance, nextPending }
}

const handlerLookup = (obj: Record<string | symbol, Message[]>, prop: string | symbol): Message[] =>
    (obj[prop] || [])

const messageStateProxy = (branch: MessageState): MessageState =>
    new Proxy(branch, {
        get: (target: MessageState, property: string | symbol) => (handlerLookup(target, property.toString())),
        ownKeys: (messages: MessageState) => {
            return (Object.keys(messages) as string[]).sort()
        },
        getOwnPropertyDescriptor: (obj, prop) => {
            const value = handlerLookup(obj, prop)
            return {
                configurable: Object.getOwnPropertyDescriptor(obj, prop)?.configurable,
                enumerable: Boolean(obj[prop.toString() as any]),
                value
            }
        }
    }) as MessageState

/** Full revision log (`history`). Use for audit/debug; default UI uses `getPresentation`. */
export const getMessages: Selector<MessageState> = (state) => messageStateProxy(state.messages.history)

/**
 * Transcript view for UI (one row per `MessageId`). `Message.CreatedTime` is transcript
 * position (`earliestCreatedTime`), not necessarily the latest revision time; see `toPresentationRow` in `index.ts`.
 */
export const getPresentation: Selector<MessageState> = (state) => messageStateProxy(state.messages.presentation)

/** Virtual sticky header state: transcript anchor is always the render-channel header when present. */
export type MessageRoomBreakdownHeader = {
    header: RoomHeaderMessage;
    renderHeader?: RoomHeaderMessage;
    affordanceHeader?: RoomHeaderMessage;
    /** Set while affordance headers exist before the first render header for this section (UI 10s withhold clock). */
    firstAffordanceWithoutRenderCreatedTime?: number;
    messageCount: number;
}

export type MessageRoomBreakdown = {
    Messages: Message[];
    Groups: MessageRoomBreakdownHeader[];
}

type MessageRoomInProgress = {
    Messages: Message[];
    Groups: MessageRoomBreakdownHeader[];
    currentGroup: MessageRoomBreakdownHeader;
    /** Latest affordance header per room id when it does not match the open section (or before render opens the section). */
    pendingAffordanceByRoom: Record<string, RoomHeaderMessage>;
}

const combineCurrentHeader = (
    { Messages, Groups, currentGroup, pendingAffordanceByRoom }: MessageRoomInProgress,
    newRenderMessage?: RoomHeaderMessage
): MessageRoomInProgress => {
    let nextPending = pendingAffordanceByRoom
    let affordanceForNewRender: RoomHeaderMessage | undefined

    if (newRenderMessage) {
        const taken = takePendingAffordance(pendingAffordanceByRoom, getRoomId(newRenderMessage))
        affordanceForNewRender = taken.affordance
        nextPending = taken.nextPending
    }

    const startNextGroup = (): MessageRoomBreakdownHeader => {
        if (newRenderMessage) {
            return {
                header: newRenderMessage,
                renderHeader: newRenderMessage,
                affordanceHeader: affordanceForNewRender ?? undefined,
                firstAffordanceWithoutRenderCreatedTime: undefined,
                messageCount: 0
            }
        }
        return {
            header: currentGroup.header,
            renderHeader: currentGroup.renderHeader,
            affordanceHeader: currentGroup.affordanceHeader ?? undefined,
            firstAffordanceWithoutRenderCreatedTime: currentGroup.firstAffordanceWithoutRenderCreatedTime ?? undefined,
            messageCount: 0
        }
    }

    if (currentGroup.messageCount > 0) {
        return {
            Messages,
            Groups: [...Groups, currentGroup],
            currentGroup: startNextGroup(),
            pendingAffordanceByRoom: newRenderMessage ? nextPending : pendingAffordanceByRoom
        }
    }

    return {
        Messages: [
            ...Messages,
            {
                DisplayProtocol: 'SpacerMessage',
                MessageId: `MESSAGE#${uuidv4()}`,
                Target: currentGroup.header.Target,
                CreatedTime: currentGroup.header.CreatedTime + 1
            }
        ],
        Groups: [...Groups, { ...currentGroup, messageCount: 1 }],
        currentGroup: startNextGroup(),
        pendingAffordanceByRoom: newRenderMessage ? nextPending : pendingAffordanceByRoom
    }
}

/** Room-grouped timeline for the main transcript. Reads `presentation`, not full `history`. */
export const getMessagesByRoom: (CharacterId: EphemeraCharacterId) => Selector<MessageRoomBreakdown> = (CharacterId) => createSelector(
    getPresentation,
    (allMessages) => {
        let messages = [] as Message[]
        let initialHeader = undefined as MessageRoomBreakdownHeader | undefined
        let initialPending: Record<string, RoomHeaderMessage> = {}
        const probeMessages = allMessages[CharacterId]
        
        if (!probeMessages.length) {
            return {
                Messages: [],
                Groups: []
            }
        }
        
        if (isRoomHeader(probeMessages[0])) {
            const first = probeMessages[0] as RoomHeaderMessage
            if (isAffordanceRoomHeader(first)) {
                const roomId = getRoomId(first)
                initialPending = { [roomId]: first }
                initialHeader = {
                    header: first,
                    affordanceHeader: first,
                    firstAffordanceWithoutRenderCreatedTime: first.CreatedTime,
                    messageCount: 0
                }
            }
            else {
                initialHeader = {
                    header: first,
                    renderHeader: first,
                    affordanceHeader: undefined,
                    firstAffordanceWithoutRenderCreatedTime: undefined,
                    messageCount: 0
                }
            }
            messages = probeMessages.slice(1)
        }
        else {
            // Create a fallback PerceptionMessage for unknown room (treat as render anchor).
            const fallbackHeader: RoomHeaderMessage = {
                DisplayProtocol: 'PerceptionMessage',
                MessageId: 'NONE',
                Target: CharacterId,
                CreatedTime: probeMessages[0].CreatedTime,
                wmlContent: '<Room key=(none)><ShortName>Unknown</ShortName><Description>??????</Description></Room>',
                metaData: {
                    componentUUID: 'ROOM#NONE',
                    displayMode: 'header'
                }
            }
            initialHeader = {
                header: fallbackHeader,
                renderHeader: fallbackHeader,
                affordanceHeader: undefined,
                firstAffordanceWithoutRenderCreatedTime: undefined,
                messageCount: 0
            }
            messages = probeMessages
        }
        
        const aggregate: MessageRoomInProgress = messages.reduce((previous, message) => {
            if (isAffordanceRoomHeader(message as PerceptionMessage)) {
                const m = message as RoomHeaderMessage
                const roomId = getRoomId(m)
                const prevP = previous.pendingAffordanceByRoom[roomId]
                const nextAffPending =
                    !prevP || m.CreatedTime >= prevP.CreatedTime ? m : prevP
                const nextPendingMap = { ...previous.pendingAffordanceByRoom, [roomId]: nextAffPending }
                const sectionRoomId = getRoomId(previous.currentGroup.header)
                if (roomId !== sectionRoomId) {
                    return { ...previous, pendingAffordanceByRoom: nextPendingMap }
                }
                const hasRender = Boolean(previous.currentGroup.renderHeader)
                const nextFirst = hasRender
                    ? undefined
                    : previous.currentGroup.firstAffordanceWithoutRenderCreatedTime !== undefined
                      ? Math.min(previous.currentGroup.firstAffordanceWithoutRenderCreatedTime, m.CreatedTime)
                      : m.CreatedTime
                return {
                    ...previous,
                    pendingAffordanceByRoom: nextPendingMap,
                    currentGroup: {
                        ...previous.currentGroup,
                        header: hasRender ? previous.currentGroup.header : nextAffPending,
                        affordanceHeader: nextAffPending,
                        firstAffordanceWithoutRenderCreatedTime: nextFirst,
                        messageCount: previous.currentGroup.messageCount
                    }
                }
            }

            if (isRenderRoomHeader(message as PerceptionMessage)) {
                const m = message as RoomHeaderMessage
                const roomId = getRoomId(m)
                const previousRoomId = getRoomId(previous.currentGroup.header)

                if (roomId === previousRoomId) {
                    const pendingAff = previous.pendingAffordanceByRoom[roomId]
                    let mergedAff = previous.currentGroup.affordanceHeader
                    if (pendingAff) {
                        mergedAff =
                            !mergedAff || pendingAff.CreatedTime >= mergedAff.CreatedTime
                                ? pendingAff
                                : mergedAff
                    }
                    const { nextPending } = takePendingAffordance(previous.pendingAffordanceByRoom, roomId)
                    return {
                        ...previous,
                        pendingAffordanceByRoom: nextPending,
                        currentGroup: {
                            ...previous.currentGroup,
                            header: m,
                            renderHeader: m,
                            affordanceHeader: mergedAff,
                            firstAffordanceWithoutRenderCreatedTime: undefined,
                            messageCount: previous.currentGroup.messageCount
                        }
                    }
                }
                return combineCurrentHeader(previous, m)
            }

            if (isRoomHeader(message)) {
                return previous
            }

            switch (message.DisplayProtocol) {
                case 'RoomUpdate':
                    return {
                        Messages: previous.Messages,
                        Groups: previous.Groups,
                        pendingAffordanceByRoom: previous.pendingAffordanceByRoom,
                        currentGroup: {
                            ...previous.currentGroup,
                            messageCount: previous.currentGroup.messageCount
                        }
                    }
                default:
                    return {
                        Messages: [...previous.Messages, message],
                        Groups: previous.Groups,
                        pendingAffordanceByRoom: previous.pendingAffordanceByRoom,
                        currentGroup: {
                            ...previous.currentGroup,
                            messageCount: previous.currentGroup.messageCount + 1
                        }
                    }
            }
        }, {
            Messages: [],
            Groups: [],
            currentGroup: initialHeader,
            pendingAffordanceByRoom: initialPending
        } as MessageRoomInProgress)
        
        const { currentGroup: _discard, pendingAffordanceByRoom: _pending, ...rest } = combineCurrentHeader(aggregate)
        return rest
    }
)

type MessageRecentVisit = {
    ephemeraId: string;
    name: string;
    assets: {
        fromAssetId: AssetUUID;
        universalKey: ComponentUUID;
    }[];
    tag: SchemaImportMapping["type"];
}

/** Recent room visits from the same collapsed transcript as the main UI (`presentation`). */
export const getRecentlyVisited: (fromTime: number) => Selector<MessageRecentVisit[]> = (fromTime) => createSelector(
    getPresentation,
    (allMessages) => {
        const recentlyVisited: MessageRecentVisit[] = Object.values(allMessages)
            .map((messages) => {
                const firstIndex = binarySearch(messages, fromTime)
                return messages.slice(firstIndex.index)
            })
            .flat(1)
            .reduce<MessageRecentVisit[]>((previous, message) => {
                if (message.DisplayProtocol === 'PerceptionMessage') {
                    const perceptionMessage = message as PerceptionMessage & { parsedWML?: StandardForm }
                    const ephemeraId = perceptionMessage.metaData?.componentUUID
                    const meta = perceptionMessage.metaData
                    if (
                        meta &&
                        isPerceptionRoomMetaData(meta) &&
                        meta.displayMode === 'header' &&
                        resolvedPerceptionRoomChannel(meta) === 'affordances'
                    ) {
                        return previous
                    }

                    if (ephemeraId) {
                        // Extract name from WML content or metadata
                        let name = 'Unknown'
                        let tag: SchemaImportMapping["type"] = 'Room' // Default fallback
                        let adjustedAssets: MessageRecentVisit["assets"] = []
                        
                        // Determine component type from componentUUID
                        if (ephemeraId.startsWith('ROOM#')) {
                            tag = 'Room'
                        } else if (ephemeraId.startsWith('FEATURE#')) {
                            tag = 'Feature'
                        } else if (ephemeraId.startsWith('KNOWLEDGE#')) {
                            tag = 'Knowledge'
                        }
                        
                        // Try to extract name from parsed WML if available
                        if (perceptionMessage.parsedWML) {
                            const component = perceptionMessage.parsedWML.byUniversalId[ephemeraId]
                            if (component) {
                                const label = perceptionMessageDisplayLabel(component)
                                if (label) {
                                    name = label
                                }
                                
                                // Extract assets if available
                                const assets = (component as any).assets || {}
                                adjustedAssets = Object.entries(assets)
                                    .filter(([fromAsset]) => (((Object.keys(assets)).length === 1) || fromAsset !== 'ASSET#primitives'))
                                    .filter(([_, key]) => (key))
                                    .map(([fromAssetId, universalKey]) => ({ fromAssetId: fromAssetId as AssetUUID, universalKey: universalKey as ComponentUUID }))
                            }
                        }
                        
                        return [
                            ...previous.filter(({ ephemeraId: id }) => id !== ephemeraId),
                            {
                                ephemeraId,
                                name,
                                assets: adjustedAssets,
                                tag
                            }
                        ]    
                    }
                }
                return previous
            }, [])
        return recentlyVisited
    }
)