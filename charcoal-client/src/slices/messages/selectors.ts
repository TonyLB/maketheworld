import { createSelector } from '@reduxjs/toolkit'
import { v4 as uuidv4 } from 'uuid'

import { Message, RoomHeader, PerceptionMessage, isPerceptionRoomMetaData } from '@tonylb/mtw-interfaces/ts/messages'
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

// Helper function to check if a message is a room header (either legacy or PerceptionMessage)
const isRoomHeader = (message: Message): boolean => {
    if (message.DisplayProtocol === 'RoomHeader') {
        return true
    }
    if (message.DisplayProtocol === 'PerceptionMessage') {
        const perceptionMessage = message as PerceptionMessage
        return !!(perceptionMessage.metaData && isPerceptionRoomMetaData(perceptionMessage.metaData) && perceptionMessage.metaData.displayMode === 'header')
    }
    return false
}

// Helper function to extract room ID from either message type
const getRoomId = (message: Message): string => {
    if (message.DisplayProtocol === 'RoomHeader') {
        return (message as RoomHeader).RoomId
    }
    if (message.DisplayProtocol === 'PerceptionMessage') {
        const perceptionMessage = message as PerceptionMessage
        return perceptionMessage.metaData.componentUUID
    }
    return 'ROOM#UNKNOWN'
}

// Helper function to convert PerceptionMessage to RoomHeader-like data for selector use
const extractRoomHeaderData = (message: Message): RoomHeader => {
    if (message.DisplayProtocol === 'RoomHeader') {
        return message as RoomHeader
    }
    
    if (message.DisplayProtocol === 'PerceptionMessage') {
        const perceptionMessage = message as PerceptionMessage & { parsedWML?: StandardForm }
        const componentUUID = perceptionMessage.metaData.componentUUID
        
        // If we have parsed WML, extract the data
        if (perceptionMessage.parsedWML) {
            const component = perceptionMessage.parsedWML.byUniversalId[componentUUID]
            
            if (component instanceof StandardRoom) {
                // Extract room data similar to RoomDescription component logic
                let name: StandardRender = new StandardRender(['Untitled'])
                let description: StandardRender = new StandardRender([])
                let summary: StandardRender = new StandardRender([])
                
                // Get first example if it exists - use safe property access
                const examplesPayload = (component as any).examples?.payload
                if (examplesPayload && examplesPayload[0]) {
                    const firstExampleRef = examplesPayload[0]
                    const firstExample = perceptionMessage.parsedWML._lookup(firstExampleRef.plain().toJSON())
                    if (firstExample && firstExample.universalKey) {
                        const exampleComponent = perceptionMessage.parsedWML.byUniversalId[firstExample.universalKey as any]
                        if (exampleComponent instanceof StandardExample) {
                            name = (exampleComponent as any).name || new StandardRender(['Untitled'])
                            description = (exampleComponent as any).description || new StandardRender([])
                            summary = (exampleComponent as any).summary || new StandardRender([])
                        }
                    }
                }
                
                // Convert characters - use safe property access
                const charactersPayload = (component as any).characters?.payload || []
                const characters = charactersPayload
                    .map((characterRef: any) => {
                        const resolvedCharacter = perceptionMessage.parsedWML!._lookup(characterRef.plain().toJSON())
                        return resolvedCharacter
                    })
                    .filter((character: any) => character)
                    .map((character: any) => ({
                        CharacterId: character.universalKey || '',
                        Name: character.name?.plainString || 'Unknown',
                        fileURL: character.image?.data?.fileURL
                    }))
                
                return {
                    DisplayProtocol: 'RoomHeader',
                    MessageId: perceptionMessage.MessageId,
                    Target: perceptionMessage.Target,
                    CreatedTime: perceptionMessage.CreatedTime,
                    RoomId: componentUUID as any,
                    Name: (name as any).tree || name.toJSON(),
                    Description: (description as any).tree || description.toJSON(),
                    Summary: (summary as any).tree || summary.toJSON(),
                    Exits: (component as any).exits || [],
                    Characters: characters
                }
            }
        }
        
        // Fallback for PerceptionMessage without parsed data
        return {
            DisplayProtocol: 'RoomHeader',
            MessageId: perceptionMessage.MessageId,
            Target: perceptionMessage.Target,
            CreatedTime: perceptionMessage.CreatedTime,
            RoomId: componentUUID as any,
            Name: ['Untitled'],
            Description: ['Unable to load room'],
            Summary: [],
            Exits: [],
            Characters: []
        }
    }
    
    // Final fallback
    return {
        DisplayProtocol: 'RoomHeader',
        MessageId: message.MessageId,
        Target: message.Target || undefined,
        CreatedTime: message.CreatedTime,
        RoomId: 'ROOM#UNKNOWN' as any,
        Name: ['Unknown'],
        Description: ['Unknown room'],
        Summary: [],
        Exits: [],
        Characters: []
    }
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
    header: RoomHeader;
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

const combineCurrentHeader = ({ Messages, Groups, currentGroup }: MessageRoomInProgress, newMessage?: RoomHeader): MessageRoomInProgress => {
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
                header: extractRoomHeaderData(probeMessages[0]),
                messageCount: 0
            }
            messages = probeMessages.slice(1)
        }
        else {
            initialHeader = {
                header: {
                    DisplayProtocol: 'RoomHeader',
                    MessageId: 'NONE',
                    Target: CharacterId,
                    RoomId: 'ROOM#NONE',
                    CreatedTime: probeMessages[0].CreatedTime,
                    ShortName: 'Unknown',
                    Name: [],
                    Summary: [],
                    Description: ['??????'],
                    Exits: [],
                    Characters: []
                },
                messageCount: 0
            }
            messages = probeMessages
        }
        const aggregate: MessageRoomInProgress = messages.reduce((previous, message) => {
                if (isRoomHeader(message)) {
                    // Handle both legacy RoomHeader and PerceptionMessage room headers
                    const currentRoomId = getRoomId(message)
                    if (currentRoomId === previous.currentGroup.header.RoomId) {
                            return {
                                Messages: previous.Messages,
                                Groups: previous.Groups,
                                currentGroup: {
                                    header: {
                                        ...previous.currentGroup.header,
                                        ...extractRoomHeaderData(message)
                                    },
                                    messageCount: previous.currentGroup.messageCount
                                }
                            }
                        }
                        else {
                            return combineCurrentHeader(previous, extractRoomHeaderData(message))
                        }
                } else {
                    switch(message.DisplayProtocol) {
                        case 'RoomUpdate':
                        return {
                            Messages: previous.Messages,
                            Groups: previous.Groups,
                            currentGroup: {
                                header: {
                                    ...previous.currentGroup.header,
                                    ...{
                                        Name: message.Name || previous.currentGroup.header.Name,
                                        Description: message.Description || previous.currentGroup.header.Description,
                                        Characters: message.Characters || previous.currentGroup.header.Characters,
                                        Exits: message.Exits || previous.currentGroup.header.Exits
                                    }
                                } as RoomHeader,
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
                if (
                    message.DisplayProtocol === 'RoomHeader' ||
                    message.DisplayProtocol === 'RoomDescription' ||
                    message.DisplayProtocol === 'FeatureDescription' ||
                    message.DisplayProtocol === 'KnowledgeDescription'
                ) {
                    const ephemeraId = (message.DisplayProtocol === 'RoomHeader' || message.DisplayProtocol === 'RoomDescription')
                        ? message.RoomId
                        : message.DisplayProtocol === 'FeatureDescription'
                            ? message.FeatureId
                            : message.KnowledgeId
                    if (ephemeraId) {
                        const name = message.Name ? (Array.isArray(message.Name) ? new StandardRender(message.Name) : new StandardRender([message.Name])).plainString : ""
                        const adjustedAssets: MessageRecentVisit["assets"] = Object.entries(message.assets ?? {})
                            .filter(([fromAsset]) => (((Object.keys(message.assets ?? {})).length === 1) || fromAsset !== 'ASSET#primitives'))
                            .filter(([_, key]) => (key))
                            .map(([fromAssetId, universalKey]) => ({ fromAssetId: fromAssetId as AssetUUID, universalKey }))
                        return [
                            ...previous.filter(({ ephemeraId: id }) => id !== ephemeraId),
                            {
                                ephemeraId,
                                name,
                                assets: adjustedAssets,
                                tag: (message.DisplayProtocol === 'RoomHeader' || message.DisplayProtocol === 'RoomDescription')
                                    ? 'Room'
                                    : (message.DisplayProtocol === 'FeatureDescription')
                                        ? 'Feature'
                                        : 'Knowledge'
                            }
                        ]    
                    }
                }
                return previous
            }, [])
        return recentlyVisited
    }
)