import { createSelector } from '@reduxjs/toolkit'

import { Message, MessageState, RoomHeader } from './baseClasses'
import { Selector } from '../../store'


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
                enumerable: Boolean(obj[prop.toString()]),
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

export const getMessagesByRoom: (CharacterId: string) => Selector<MessageRoomBreakdown> = (CharacterId) => createSelector(
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
        if (probeMessages[0].DisplayProtocol === 'RoomHeader') {
            initialHeader = {
                header: probeMessages[0],
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
                    RoomId: 'NONE',
                    CreatedTime: probeMessages[0].CreatedTime,
                    Name: 'Unknown',
                    Description: '??????',
                    Exits: [],
                    RoomCharacters: []
                },
                messageCount: 0
            }
            messages = probeMessages
        }
        const { Messages, Groups, currentGroup }: MessageRoomInProgress = messages.reduce<MessageRoomInProgress>((previous, message) => {
                switch(message.DisplayProtocol) {
                    case 'RoomHeader':
                        return {
                            Messages: previous.Messages,
                            Groups: [
                                ...previous.Groups,
                                previous.currentGroup
                            ],
                            currentGroup: {
                                header: message,
                                messageCount: 0
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
            }, {
                Messages: [],
                Groups: [],
                currentGroup: initialHeader
            } as MessageRoomInProgress)
        if (currentGroup.messageCount > 0) {
            return {
                Messages,
                Groups: [...Groups, currentGroup]
            }
        }
        else {
            return {
                Messages,
                Groups
            }
        }
    }
)