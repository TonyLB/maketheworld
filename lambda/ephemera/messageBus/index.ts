import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'

import {
    MessageBus,
    isPublishMessage,
    isEphemeraUpdate,
    isDisconnectMessage,
    isConnectMessage,
    isSyncRequest,
    isSyncResponse,
    isRegisterCharacterMessage,
    isFetchPlayerEphemera,
    isPerception,
    isMoveCharacter,
    isDecacheAsset,
    isCacheAssetMessage,
    isPlayerUpdateMessage,
    isRoomUpdateMessage,
    isDescentUpdateMessage,
    isAncestryUpdateMessage,
    isDependencyCascadeMessage,
    isExecuteActionMessage,
    isMapSubscription,
    isMapUpdateMessage,
    isPublishNotification,
    isSyncNotificationRequest,
    isSyncNotificationResponse,
    isMapUnsubscribe,
    isUnregisterCharacterMessage,
    isCacheAssetByIdMessage
} from "./baseClasses"

import publishMessage from '../publishMessage'
import ephemeraUpdate from '../ephemeraUpdate'
import disconnectMessage, { unregisterCharacterMessage } from '../disconnectMessage'
import connectMessage from '../connectMessage'
import { syncNotificationRequest, syncNotificationResponse, syncRequest, syncResponse } from '../syncHandler'
import registerCharacter from '../registerCharacter'
import { fetchPlayerEphemera } from '../fetchEphemera'
import perceptionMessage from '../perception'
import moveCharacter from '../moveCharacter'
import decacheAssetMessage from '../decacheMessage'
import { cacheAssetByIdMessage, cacheAssetMessage } from '../cacheAsset'
import playerUpdateMessage from '../playerUpdate'
import roomUpdateMessage from '../roomUpdate'
import dependentUpdateMessage from '../dependentMessages/dependentUpdate'
import dependencyCascadeMessage from '../dependentMessages/dependencyCascade'
import executeActionMessage from '../executeAction'
import mapSubscriptionMessage, { mapUnsubscribeMessage } from '../mapSubscription'
import mapUpdateMessage from '../mapUpdate'
import publishNotification from '../publishNotification'

export const messageBus = new MessageBus()
messageBus.subscribe({
    tag: 'PublishMessage',
    priority: 15,
    filter: isPublishMessage,
    callback: publishMessage
})
messageBus.subscribe({
    tag: 'PublishNotification',
    priority: 15,
    filter: isPublishNotification,
    callback: publishNotification
})
messageBus.subscribe({
    tag: 'EphemeraUpdate',
    priority: 10,
    filter: isEphemeraUpdate,
    callback: ephemeraUpdate
})
messageBus.subscribe({
    tag: 'Disconnect',
    priority: 1,
    filter: isDisconnectMessage,
    callback: disconnectMessage
})
messageBus.subscribe({
    tag: 'Connect',
    priority: 1,
    filter: isConnectMessage,
    callback: connectMessage
})
messageBus.subscribe({
    tag: 'SyncResponse',
    priority: 2,
    filter: isSyncResponse,
    callback: syncResponse
})
messageBus.subscribe({
    tag: 'SyncRequest',
    priority: 3,
    filter: isSyncRequest,
    callback: syncRequest
})
messageBus.subscribe({
    tag: 'SyncNotificationResponse',
    priority: 2,
    filter: isSyncNotificationResponse,
    callback: syncNotificationResponse
})
messageBus.subscribe({
    tag: 'SyncNotificationRequest',
    priority: 3,
    filter: isSyncNotificationRequest,
    callback: syncNotificationRequest
})
messageBus.subscribe({
    tag: 'RegisterCharacter',
    priority: 1,
    filter: isRegisterCharacterMessage,
    callback: registerCharacter
})
messageBus.subscribe({
    tag: 'UnregisterCharacter',
    priority: 1,
    filter: isUnregisterCharacterMessage,
    callback: unregisterCharacterMessage
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
    tag: 'DecacheAsset',
    priority: 1,
    filter: isDecacheAsset,
    callback: decacheAssetMessage
})
messageBus.subscribe({
    tag: 'CacheAsset',
    priority: 1,
    filter: isCacheAssetMessage,
    callback: cacheAssetMessage
})
messageBus.subscribe({
    tag: 'CacheAssetById',
    priority: 10,
    filter: isCacheAssetByIdMessage,
    callback: cacheAssetByIdMessage
})
messageBus.subscribe({
    tag: 'UpdatePlayer',
    priority: 5,
    filter: isPlayerUpdateMessage,
    callback: playerUpdateMessage
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
    tag: 'AncestryUpdate',
    priority: 3,
    filter: isAncestryUpdateMessage,
    callback: dependentUpdateMessage('Ancestry')
})
messageBus.subscribe({
    tag: 'DescentUpdate',
    priority: 4,
    filter: isDescentUpdateMessage,
    callback: dependentUpdateMessage('Descent')
})

messageBus.subscribe({
    tag: 'DependencyCascade',
    priority: 5,
    filter: isDependencyCascadeMessage,
    callback: dependencyCascadeMessage
})

messageBus.subscribe({
    tag: 'ExecuteAction',
    priority: 7,
    filter: isExecuteActionMessage,
    callback: executeActionMessage
})

export default messageBus