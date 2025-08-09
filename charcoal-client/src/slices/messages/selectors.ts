import { createSelector } from '@reduxjs/toolkit'
import { v4 as uuidv4 } from 'uuid'

import { Message, PerceptionMessage, isPerceptionRoomMetaData } from '@tonylb/mtw-interfaces/ts/messages'
import { MessageState } from './baseClasses'
import { Selector } from '../../store'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import binarySearch from './binarySearch'
import { unique } from '../../lib/lists'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import { SchemaImportMapping } from '@tonylb/mtw-base/ts/schema/metaData'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { Component } from 'react'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'

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




export const getMessages: Selector<MessageState> = (state) => {
    const handlerLookup = (obj: Record<string | symbol, Message[]>, prop: string | symbol): Message[] => (obj[prop] || [])
    return new Proxy(state.messages, {
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
    })

}

type MessageRoomBreakdownHeader = {
    header: PerceptionMessage & { parsedWML?: StandardForm };
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
}

const combineCurrentHeader = ({ Messages, Groups, currentGroup }: MessageRoomInProgress, newMessage?: PerceptionMessage & { parsedWML?: StandardForm }): MessageRoomInProgress => {
    if (currentGroup.messageCount > 0) {
        return {
            Messages,
            Groups: [
                ...Groups,
                currentGroup
            ],
            currentGroup: {
                header: newMessage || currentGroup.header,
                messageCount: 0
            }
        }
    }
    else {
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
            Groups: [
                ...Groups,
                {
                    header: currentGroup.header,
                    messageCount: 1
                }
            ],
            currentGroup: {
                header: newMessage || currentGroup.header,
                messageCount: 0
            }
        }
    }
}

export const getMessagesByRoom: (CharacterId: EphemeraCharacterId) => Selector<MessageRoomBreakdown> = (CharacterId) => createSelector(
    getMessages,
    (allMessages) => {
        let messages = [] as Message[]
        let initialHeader = undefined as MessageRoomBreakdownHeader | undefined
        const probeMessages = allMessages[CharacterId]
        
        if (!probeMessages.length) {
            return {
                Messages: [],
                Groups: []
            }
        }
        
        if (isRoomHeader(probeMessages[0])) {
            initialHeader = {
                header: probeMessages[0],
                messageCount: 0
            }
            messages = probeMessages.slice(1)
        }
        else {
            // Create a fallback PerceptionMessage for unknown room
            initialHeader = {
                header: {
                    DisplayProtocol: 'PerceptionMessage',
                    MessageId: 'NONE',
                    Target: CharacterId,
                    CreatedTime: probeMessages[0].CreatedTime,
                    wmlContent: '<Room key=(none)><ShortName>Unknown</ShortName><Description>??????</Description></Room>',
                    metaData: {
                        componentUUID: 'ROOM#NONE',
                        displayMode: 'header'
                    }
                } as PerceptionMessage & { parsedWML?: StandardForm },
                messageCount: 0
            }
            messages = probeMessages
        }
        
        const aggregate: MessageRoomInProgress = messages.reduce((previous, message) => {
            if (isRoomHeader(message)) {
                // Handle PerceptionMessage room headers
                const currentRoomId = getRoomId(message)
                const previousRoomId = getRoomId(previous.currentGroup.header)
                
                if (currentRoomId === previousRoomId) {
                    // Same room - update the current header
                    return {
                        Messages: previous.Messages,
                        Groups: previous.Groups,
                        currentGroup: {
                            header: message, // Replace with newer header data
                            messageCount: previous.currentGroup.messageCount
                        }
                    }
                }
                else {
                    // Different room - create new header group
                    return combineCurrentHeader(previous, message)
                }
            } else {
                switch(message.DisplayProtocol) {
                    case 'RoomUpdate':
                        // For RoomUpdate, we maintain compatibility but don't create legacy types
                        // The UI will need to handle RoomUpdate separately or we convert it to PerceptionMessage
                        return {
                            Messages: previous.Messages,
                            Groups: previous.Groups,
                            currentGroup: {
                                header: previous.currentGroup.header, // Keep existing header as-is
                                messageCount: previous.currentGroup.messageCount
                            }
                        }
                    default:
                        return {
                            Messages: [
                                ...previous.Messages,
                                message
                            ],
                            Groups: previous.Groups,
                            currentGroup: {
                                header: previous.currentGroup.header,
                                messageCount: previous.currentGroup.messageCount + 1
                            }
                        }
                }
            }
        }, {
            Messages: [],
            Groups: [],
            currentGroup: initialHeader
        } as MessageRoomInProgress)
        
        const { currentGroup: discard, ...rest } = combineCurrentHeader(aggregate)
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

export const getRecentlyVisited: (fromTime: number) => Selector<MessageRecentVisit[]> = (fromTime) => createSelector(
    getMessages,
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
                                // Try to get name from component - this is component-specific logic
                                const componentName = (component as any).name || (component as any).shortName
                                if (componentName) {
                                    name = componentName.plainString || name
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