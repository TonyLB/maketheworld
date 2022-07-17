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
    isMoveCharacter
} from "./baseClasses"

import publishMessage from '../publishMessage'
import ephemeraUpdate from '../ephemeraUpdate'
import disconnectMessage from '../disconnectMessage'
import discconnectForAssetsMessage from '../disconnectMessage/deregisterForAssets'
import connectMessage from '../connectMessage'
import connectForAssetsMessage from '../connectMessage/registerForAsset'
import whoAmIMessage from '../whoAmI'
import { syncRequest, syncResponse } from '../syncHandler'
import registerCharacter from '../registerCharacter'
import { fetchPlayerEphemera } from '../fetchEphemera'
import { importDefaultsMessage, fetchImportDefaults } from '../fetchImportDefaults'
import perceptionMessage from '../perception'
import moveCharacter from '../moveCharacter'

export const messageBus = new MessageBus()
messageBus.subscribe({
    tag: 'PublishMessage',
    priority: 5,
    filter: isPublishMessage,
    callback: publishMessage
})
messageBus.subscribe({
    tag: 'EphemeraUpdate',
    priority: 5,
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
    tag: 'DisconnectForAsset',
    priority: 1,
    filter: isDisconnectMessage,
    callback: discconnectForAssetsMessage
})
messageBus.subscribe({
    tag: 'Connect',
    priority: 1,
    filter: isConnectMessage,
    callback: connectMessage
})
// messageBus.subscribe({
//     tag: 'ConnectForAsset',
//     priority: 1,
//     filter: isConnectMessage,
//     callback: connectForAssetsMessage
// })
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
    priority: 3,
    filter: isPerception,
    callback: perceptionMessage
})
messageBus.subscribe({
    tag: 'MoveCharacter',
    priority: 4,
    filter: isMoveCharacter,
    callback: moveCharacter
})

export default messageBus