import {
    MessageBus,
    isPublishMessage,
    isEphemeraUpdate,
    isFetchPlayerEphemera,
    isPerception,
    isMoveCharacter,
    isRoomUpdateMessage,

    isMapSubscription,
    isMapUpdateMessage,
    isMapUnsubscribe,
    isUnregisterCharacterMessage,
    isCanonUpdateMessage,
    isCheckLocation,
    isDisconnectCharacterMessage,
    isCharacterEventMessage,
    isExecuteActionMessage
} from "./baseClasses"

import publishMessage from '../publishMessage'
import { publishMessageCoalescer } from '../publishMessage/coalescer'
import ephemeraUpdate from '../ephemeraUpdate'
import { unregisterCharacterMessage, disconnectCharacterMessage } from '../disconnectMessage'
import { fetchPlayerEphemera } from '../fetchEphemera'
import perceptionMessage from '../perception'
import moveCharacter from '../moveCharacter'
import roomUpdateMessage from '../roomUpdate'

import mapSubscriptionMessage, { mapUnsubscribeMessage } from '../mapSubscription'
import mapUpdateMessage from '../mapUpdate'
import checkLocation from "../checkLocation"
import characterEvent from "../characterEvents"
import { executeActionMessage } from "../parse/executeAction"

export const messageBus = new MessageBus()
messageBus.subscribe({
    tag: 'PublishMessage',
    priority: 15,
    filter: isPublishMessage,
    callback: publishMessage
})
messageBus.subscribe({
    tag: 'EphemeraUpdate',
    priority: 10,
    filter: isEphemeraUpdate,
    callback: ephemeraUpdate
})
messageBus.subscribe({
    tag: 'UnregisterCharacter',
    priority: 1,
    filter: isUnregisterCharacterMessage,
    callback: unregisterCharacterMessage
})
messageBus.subscribe({
    tag: 'DisconnectCharacter',
    priority: 1,
    filter: isDisconnectCharacterMessage,
    callback: disconnectCharacterMessage
})
messageBus.subscribe({
    tag: 'FetchPlayerEphemera',
    priority: 2,
    filter: isFetchPlayerEphemera,
    callback: fetchPlayerEphemera
})
messageBus.subscribe({
    tag: 'MapSubscription',
    priority: 2,
    filter: isMapSubscription,
    callback: mapSubscriptionMessage
})
messageBus.subscribe({
    tag: 'MapUnsubscribe',
    priority: 2,
    filter: isMapUnsubscribe,
    callback: mapUnsubscribeMessage
})
messageBus.subscribe({
    tag: 'Perception',
    priority: 10,
    filter: isPerception,
    callback: perceptionMessage
})
messageBus.subscribe({
    tag: 'MoveCharacter',
    priority: 4,
    filter: isMoveCharacter,
    callback: moveCharacter
})
messageBus.subscribe({
    tag: 'CheckLocation',
    priority: 3,
    filter: isCheckLocation,
    callback: checkLocation
})
messageBus.subscribe({
    tag: 'CharacterEvent',
    priority: 3,
    filter: isCharacterEventMessage,
    callback: characterEvent
})
messageBus.subscribe({
    tag: 'RoomUpdate',
    priority: 6,
    filter: isRoomUpdateMessage,
    callback: roomUpdateMessage
})
messageBus.subscribe({
    tag: 'MapUpdate',
    priority: 15,
    filter: isMapUpdateMessage,
    callback: mapUpdateMessage
})
messageBus.subscribe({
    tag: 'ExecuteAction',
    priority: 5,
    filter: isExecuteActionMessage,
    callback: executeActionMessage
})

publishMessageCoalescer.registerDeferral(messageBus)

export default messageBus