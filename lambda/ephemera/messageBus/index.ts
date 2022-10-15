import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'

import {
    MessageBus,
    isPublishMessage,
    isEphemeraUpdate,
    isDisconnectMessage,
    isConnectMessage,
    isWhoAmIMessage,
    isSyncRequest,
    isSyncResponse,
    isRegisterCharacterMessage,
    isFetchPlayerEphemera,
    isImportDefaults,
    isFetchImportDefaults,
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
    isMapUpdateMessage
} from "./baseClasses"

import publishMessage from '../publishMessage'
import ephemeraUpdate from '../ephemeraUpdate'
import disconnectMessage from '../disconnectMessage'
import connectMessage from '../connectMessage'
import whoAmIMessage from '../whoAmI'
import { syncRequest, syncResponse } from '../syncHandler'
import registerCharacter from '../registerCharacter'
import { fetchPlayerEphemera } from '../fetchEphemera'
import { importDefaultsMessage, fetchImportDefaults } from '../fetchImportDefaults'
import perceptionMessage from '../perception'
import moveCharacter from '../moveCharacter'
import decacheAssetMessage from '../decacheMessage'
import { cacheAssetMessage } from '../cacheAsset'
import playerUpdateMessage from '../playerUpdate'
import roomUpdateMessage from '../roomUpdate'
import dependentUpdateMessage from '../dependentMessages/dependentUpdate'
import dependencyCascadeMessage from '../dependentMessages/dependencyCascade'
import executeActionMessage from '../executeAction'
import mapSubscriptionMessage from '../mapSubscription'
import mapUpdateMessage from '../mapUpdate'

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
    tag: 'WhoAmI',
    priority: 1,
    filter: isWhoAmIMessage,
    callback: whoAmIMessage
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
    tag: 'RegisterCharacter',
    priority: 1,
    filter: isRegisterCharacterMessage,
    callback: registerCharacter
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
    tag: 'ImportDefaults',
    priority: 3,
    filter: isImportDefaults,
    callback: importDefaultsMessage
})
messageBus.subscribe({
    tag: 'FetchImportDefaults',
    priority: 2,
    filter: isFetchImportDefaults,
    callback: fetchImportDefaults
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
    priority: 6,
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