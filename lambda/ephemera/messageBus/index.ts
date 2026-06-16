import {
    MessageBus,
    isPublishMessage,
    isEphemeraUpdate,
    isFetchPlayerEphemera,
    isPerception,
    isRoomUpdateMessage,

    isMapSubscription,
    isMapUpdateMessage,
    isMapUnsubscribe,
    isCharacterEventMessage
} from "./baseClasses"

import publishMessage from '../publishMessage'
import { publishMessageCoalescer } from '../publishMessage/coalescer'
import ephemeraUpdate from '../ephemeraUpdate'
import { fetchPlayerEphemera } from '../fetchEphemera'
import perceptionMessage from '../perception'
import roomUpdateMessage from '../roomUpdate'

import mapSubscriptionMessage, { mapUnsubscribeMessage } from '../mapSubscription'
import mapUpdateMessage from '../mapUpdate'
import characterEvent from "../characterEvents"
import { registerReturnValueCollector } from '../returnValue/collector'

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

publishMessageCoalescer.registerDeferral(messageBus)
registerReturnValueCollector(messageBus)

export default messageBus