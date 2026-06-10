import {
    MessageBus,
    isFetchAssetAPIMessage,
    isUploadURLMessage,
    isFetchImportsAPIMessage,
    isPlayerSettingMessage,
    isReturnValueMessage,
    isCollaborationStatusMessage
} from "./baseClasses"
import fetchAssetMessage from "../fetch"
import { uploadURLMessage } from "../upload"
import { fetchImportsMessage } from "../fetchImportDefaults"
import playerSettingMessage from "../player/update"
import returnValueMessage from "../returnValue"
import { registerReturnValueCollector } from "../returnValue/collector"
import collaborationStatusMessage from "../collaborationStatus"

export const messageBus = new MessageBus()
registerReturnValueCollector(messageBus)

messageBus.subscribe({
    tag: 'FetchImports',
    priority: 5,
    filter: isFetchImportsAPIMessage,
    callback: fetchImportsMessage
})
messageBus.subscribe({
    tag: 'FetchAsset',
    priority: 5,
    filter: isFetchAssetAPIMessage,
    callback: fetchAssetMessage
})
messageBus.subscribe({
    tag: 'UploadURL',
    priority: 5,
    filter: isUploadURLMessage,
    callback: uploadURLMessage
})
// Legacy PlayerInfo subscription removed - player data now flows through mtw.assets.players data source
messageBus.subscribe({
    tag: 'PlayerSettings',
    priority: 5,
    filter: isPlayerSettingMessage,
    callback: playerSettingMessage
})
messageBus.subscribe({
    tag: 'ReturnValue',
    priority: 9,
    filter: isReturnValueMessage,
    callback: returnValueMessage
})
messageBus.subscribe({
    tag: 'CollaborationStatus',
    priority: 5,
    filter: isCollaborationStatusMessage,
    callback: collaborationStatusMessage
})

export default messageBus