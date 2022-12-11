import { EphemeraActionId, EphemeraCharacterId, EphemeraFeatureId, EphemeraMapId, EphemeraNotificationId, EphemeraRoomId, isEphemeraActionId, isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraMapId, isEphemeraNotificationId, isEphemeraRoomId } from "./baseClasses"
import { LegalCharacterColor } from './baseClasses'
import { isMapDescribeData, isMessage, isNotification, MapDescribeData, Message, Notification } from "./messages"
import { checkAll, checkTypes } from "./utils";

export type RegisterCharacterAPIMessage = {
    message: 'registercharacter';
    CharacterId: EphemeraCharacterId;
}

export type FetchEphemeraAPIMessage = {
    message: 'fetchEphemera';
    CharacterId?: string;
}

export type WhoAmIAPIMessage = {
    message: 'whoAmI';
}

export type SyncAPIMessage = {
    message: 'sync';
    CharacterId: string;
    startingAt?: number;
    limit?: number;
}

export type SyncNotificationAPIMessage = {
    message: 'syncNotification';
    startingAt?: number;
    limit?: number;
}

type UpdateNotificationsSingleUpdate = {
    target: string;
    notificationId: EphemeraNotificationId;
    read?: boolean;
    archived?: boolean;
}

const isValidNotificationUpdate = (value: any): value is UpdateNotificationsSingleUpdate => {
    if (checkTypes(value, { target: 'string', notificationId: 'string' }) && isEphemeraNotificationId(value.notificationId)) {
        if ('read' in value && typeof value.read !== 'boolean') {
            return false
        }
        if ('archived' in value && typeof value.archived !== 'boolean') {
            return false
        }
        return true
    }
    return false
}

export type UpdateNotificationsAPIMessage = {
    message: 'updateNotifications';
    updates: UpdateNotificationsSingleUpdate[];
}

export type MapSubscribeAPIMessage = {
    message: 'subscribeToMaps';
    CharacterId: string;
}

type ActionAPILookMessage = {
    actionType: 'look';
    payload: {
        CharacterId: EphemeraCharacterId;
        EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraMapId;
    }
}

type ActionAPICommunicationMetaMessage = {
    payload: {
        CharacterId: EphemeraCharacterId;
        Message: string;
    }
}

type ActionAPISayMessage = {
    actionType: 'SayMessage';
} & ActionAPICommunicationMetaMessage

type ActionAPINarrateMessage = {
    actionType: 'NarrateMessage';
} & ActionAPICommunicationMetaMessage

type ActionAPIOOCMessage = {
    actionType: 'OOCMessage';
} & ActionAPICommunicationMetaMessage

type ActionAPIMoveMessage = {
    actionType: 'move';
    payload: {
        CharacterId: EphemeraCharacterId;
        RoomId: EphemeraRoomId;
        ExitName?: string;
    }
}

type ActionAPIHomeMessage = {
    actionType: 'home';
    payload: {
        CharacterId: EphemeraCharacterId;
    }
}

export type ActionAPIMessage = {
    message: 'action';
} & (
    ActionAPILookMessage |
    ActionAPISayMessage |
    ActionAPINarrateMessage |
    ActionAPIOOCMessage |
    ActionAPIMoveMessage |
    ActionAPIHomeMessage
)

export type LinkAPIMessage = {
    message: 'link';
    to: EphemeraFeatureId | EphemeraActionId | EphemeraCharacterId;
    CharacterId: EphemeraCharacterId;
}

export type CommandAPIMessage = {
    message: 'command';
    CharacterId: EphemeraCharacterId;
    command: string;
}

export type EphemeraAPIMessage = { RequestId?: string } & (
    RegisterCharacterAPIMessage |
    FetchEphemeraAPIMessage |
    WhoAmIAPIMessage |
    SyncAPIMessage |
    SyncNotificationAPIMessage |
    UpdateNotificationsAPIMessage |
    MapSubscribeAPIMessage |
    ActionAPIMessage |
    LinkAPIMessage |
    CommandAPIMessage
)

export const isRegisterCharacterAPIMessage = (message: EphemeraAPIMessage): message is RegisterCharacterAPIMessage => (message.message === 'registercharacter')
export const isFetchEphemeraAPIMessage = (message: EphemeraAPIMessage): message is FetchEphemeraAPIMessage => (message.message === 'fetchEphemera')
export const isWhoAmIAPIMessage = (message: EphemeraAPIMessage): message is WhoAmIAPIMessage => (message.message === 'whoAmI')
export const isSyncAPIMessage = (message: EphemeraAPIMessage): message is SyncAPIMessage => (message.message === 'sync')
export const isSyncNotificationAPIMessage = (message: EphemeraAPIMessage): message is SyncNotificationAPIMessage => (message.message === 'syncNotification')
export const isUpdateNotificationsAPIMessage = (message: EphemeraAPIMessage): message is UpdateNotificationsAPIMessage => (message.message === 'updateNotifications')
export const isMapSubscribeAPIMessage = (message: EphemeraAPIMessage): message is MapSubscribeAPIMessage => (message.message === 'subscribeToMaps')
export const isActionAPIMessage = (message: EphemeraAPIMessage): message is ActionAPIMessage => (message.message === 'action')
export const isLinkAPIMessage = (message: EphemeraAPIMessage): message is LinkAPIMessage => (message.message === 'link')
export const isCommandAPIMessage = (message: EphemeraAPIMessage): message is CommandAPIMessage => (message.message === 'command')

export const isEphemeraAPIMessage = (message: any): message is EphemeraAPIMessage => {
    if (typeof message !== 'object') {
        return false
    }
    if (!('message' in message)) {
        return false
    }
    switch(message.message) {
        case 'registercharacter':
            return Boolean(
                checkTypes(message, { CharacterId: 'string' })
                && isEphemeraCharacterId(message.CharacterId)
            )
        case 'subscribeToMaps':
        case 'fetchEphemera':
            return checkTypes(message, {}, { CharacterId: 'string' })
        case 'whoAmI':
            return true
        case 'sync':
            return Boolean(
                'CharacterId' in message
                && typeof message.CharacterId === 'string'
                /* && isEphemeraCharacterId(message.CharacterId)*/
                && (typeof (message.startingAt ?? 0) === 'number')
                && (typeof (message.limit ?? 0) === 'number')
            )
        case 'syncNotification':
            return Boolean(
                (typeof (message.startingAt ?? 0) === 'number')
                && (typeof (message.limit ?? 0) === 'number')
            )
        case 'updateNotifications':
                return checkAll(message.notifications.map(isValidNotificationUpdate))
        case 'link':
            return Boolean(
                checkTypes(message, { CharacterId: 'string', to: 'string' })
                && isEphemeraCharacterId(message.CharacterId)
                && (isEphemeraFeatureId(message.to) || isEphemeraActionId(message.to) || isEphemeraCharacterId(message.to))
            )
        case 'command':
            return Boolean(
                checkTypes(message, { CharacterId: 'string', command: 'string' })
                && isEphemeraCharacterId(message.CharacterId)
            )
        case 'action':
            if (!('actionType' in message && 'payload' in message && typeof message.payload === 'object')) {
                return false
            }
            switch(message.actionType) {
                case 'look':
                    return Boolean(
                        'CharacterId' in message.payload
                        && typeof message.payload.CharacterId === 'string'
                        && isEphemeraCharacterId(message.payload.CharacterId)
                        && 'EphemeraId' in message.payload
                        && typeof message.payload.EphemeraId === 'string'
                        && (
                            isEphemeraRoomId(message.payload.EphemeraId)
                            || isEphemeraFeatureId(message.payload.EphemeraId)
                            || isEphemeraMapId(message.payload.EphemeraId)
                        )
                    )
                case 'SayMessage':
                case 'NarrateMessage':
                case 'OOCMessage':
                    return Boolean(
                        'CharacterId' in message.payload
                        && typeof message.payload.CharacterId === 'string'
                        && isEphemeraCharacterId(message.payload.CharacterId)
                        && 'Message' in message.payload
                        && typeof message.payload.Message === 'string'
                    )
                case 'move':
                    return Boolean(
                        'CharacterId' in message.payload
                        && typeof message.payload.CharacterId === 'string'
                        && isEphemeraCharacterId(message.payload.CharacterId)
                        && 'RoomId' in message.payload
                        && typeof message.payload.RoomId === 'string'
                        && isEphemeraRoomId(message.payload.RoomId)
                        && (typeof (message.payload.ExitName || 'default') === 'string')
                    )
                case 'home':
                    return Boolean(
                        'CharacterId' in message.payload
                        && typeof message.payload.CharacterId === 'string'
                        && isEphemeraCharacterId(message.payload.CharacterId)
                    )
                default: return false
            }
        default: return false
    }
}

export type EphemeraClientMessageEphemeraUpdateCharacterInPlayInactive = {
    type: 'CharacterInPlay';
    CharacterId: EphemeraCharacterId;
    Connected: false;
}

export type EphemeraClientMessageEphemeraUpdateCharacterInPlayActive = {
    type: 'CharacterInPlay';
    CharacterId: EphemeraCharacterId;
    Connected: true;
    RoomId: EphemeraRoomId;
    Name: string;
    fileURL?: string;
    Color: LegalCharacterColor;
}

export type EphemeraClientMessageEphemeraUpdateCharacterInPlay = EphemeraClientMessageEphemeraUpdateCharacterInPlayInactive | EphemeraClientMessageEphemeraUpdateCharacterInPlayActive

const isEphemeraClientMessageEphemeraUpdateCharacterInPlay = (message: any): message is EphemeraClientMessageEphemeraUpdateCharacterInPlay => {
    if (typeof message === 'object' && 'type' in message && message.type === 'CharacterInPlay') {
        if ('Connected' in message && typeof message.Connected === 'boolean') {
            if (!message.Connected) {
                return true
            }
            if (!('CharacterId' in message && typeof message.CharacterId === 'string' && isEphemeraCharacterId(message.CharacterId))) {
                return false
            }
            if (!('RoomId' in message && typeof message.RoomId === 'string' && isEphemeraRoomId(message.RoomId))) {
                return false
            }
            if (!('Name' in message && typeof message.Name === 'string')) {
                return false
            }
            if ('fileURL' in message && !(typeof message.CharacterId === 'string')) {
                return false
            }
            return ['blue', 'pink', 'purple', 'green', 'grey'].includes(message.Color)
        }
    }
    return false
}

export type EphemeraClientMessageEphemeraUpdateMapItemInactive = {
    type: 'MapUpdate';
    targets: EphemeraCharacterId[];
    MapId: EphemeraMapId;
    active: false;
}

export type EphemeraClientMessageEphemeraUpdateMapItemActive = {
    type: 'MapUpdate';
    targets: EphemeraCharacterId[];
    active: true;
} & MapDescribeData

export type EphemeraClientMessageEphemeraUpdateMapClear = {
    type: 'MapClear';
    targets: EphemeraCharacterId[];
}

export type EphemeraClientMessageEphemeraUpdateMapItem = EphemeraClientMessageEphemeraUpdateMapItemInactive | EphemeraClientMessageEphemeraUpdateMapItemActive

export const isEphemeraClientMessageEphemeraUpdateMapItem = (message: any): message is EphemeraClientMessageEphemeraUpdateMapItem => {
    if (
        typeof message === 'object' &&
        'type' in message &&
        message.type === 'MapUpdate' &&
        'active' in message &&
        typeof message.active === 'boolean'
    ) {
        if (!message.active) {
            return true
        }
        if (!('MapId' in message && typeof message.MapId === 'string' && isEphemeraMapId(message.MapId))) {
            return false
        }
        return isMapDescribeData(message)
    }
    return false
}

export const isEphemeraClientMessageephemeraUpdateMapClear = (message: any): message is EphemeraClientMessageEphemeraUpdateMapItem => {
    if (
        typeof message === 'object' &&
        'type' in message &&
        message.type === 'MapClear'
    ) {
        if (!Array.isArray(message.targets)) {
            return false
        }
        return checkAll(...(message.targets.map((target) => (typeof target === 'string' && isEphemeraCharacterId(target)))))
    }
    return false
}

export type EphemeraClientMessageEphemeraUpdateItem = EphemeraClientMessageEphemeraUpdateCharacterInPlay | EphemeraClientMessageEphemeraUpdateMapItem  | EphemeraClientMessageEphemeraUpdateMapClear

export type EphemeraClientMessageEphemeraUpdate = {
    messageType: 'Ephemera';
    RequestId?: string;
    updates: EphemeraClientMessageEphemeraUpdateItem[];
}

export type EphemeraClientMessagePublishMessages = {
    messageType: 'Messages';
    RequestId?: string;
    messages: Message[];
}

export type EphemeraClientMessagePublishNotifications = {
    messageType: 'Notifications';
    RequestId?: string;
    notifications: Notification[];
}

export type EphemeraClientMessageRegisterMessage = {
    messageType: 'Registration';
    RequestId?: string;
    CharacterId: string;
}

export type EphemeraClientMessageSubscribeToMapsMessage = {
    messageType: 'SubscribeToMaps';
    RequestId?: string;
}

export type EphemeraClientMessage = EphemeraClientMessageEphemeraUpdate |
    EphemeraClientMessagePublishMessages |
    EphemeraClientMessagePublishNotifications |
    EphemeraClientMessageRegisterMessage |
    EphemeraClientMessageSubscribeToMapsMessage

export const isEphemeraClientMessage = (message: any): message is EphemeraClientMessage => {
    if (!('messageType' in message && typeof message.messageType === 'string')) {
        return false
    }
    switch(message.messageType) {
        case 'Registration':
            return checkTypes(message, { CharacterId: 'string' }, { RequestId: 'string' })
        case 'SubscribeToMaps':
            return checkTypes(message, {}, { RequestId: 'string' })
        case 'Ephemera':
            if (!('updates' in message)) {
                return false
            }
            const updates = message.updates
            if (!Array.isArray(updates)) {
                return false
            }
            return updates.reduce<boolean>((previous, update) => {
                return previous && (
                    isEphemeraClientMessageEphemeraUpdateCharacterInPlay(update) 
                    || isEphemeraClientMessageEphemeraUpdateMapItem(update)
                    || isEphemeraClientMessageephemeraUpdateMapClear(update)
                )
            }, true)
        case 'Messages':
            if (!('messages' in message)) {
                return false
            }
            const messages = message.messages
            if (!Array.isArray(messages)) {
                return false
            }            
            return messages.reduce<boolean>((previous, subMessage) => (
                previous && isMessage(subMessage)
            ), true)
        case 'Notifications':
            if (!('notifications' in message)) {
                return false
            }
            const notifications = message.notifications
            if (!Array.isArray(notifications)) {
                return false
            }            
            return notifications.reduce<boolean>((previous, subMessage) => (
                previous && isNotification(subMessage)
            ), true)
        default: return false
    }
}