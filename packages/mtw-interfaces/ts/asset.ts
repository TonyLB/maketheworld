import { ComponentUUID } from "@tonylb/mtw-base/ts/schema";
import { EphemeraAssetId, EphemeraCharacterId, isEphemeraAssetId, isEphemeraCharacterId } from "./baseClasses";
import { LibraryAsset, LibraryCharacter } from "./library";
import { checkAll, checkTypes } from "./utils";

export type FetchLibraryAPIMessage = {
    message: 'fetchLibrary';
}

export type MetaDataAPIMessage = {
    message: 'metaData';
    assetIds: `ASSET#${string}`[];
}

export type FetchImportsAPIMessage = {
    message: 'fetchImports';
    assetId: `ASSET#${string}`;
    keys: ComponentUUID[];
}


export type FetchAssetAPIMessage = {
    message: 'fetch';
    AssetId?: string;
    fileName?: string;
}

type UploadAssetLinkAPIImage = {
    key: string;
    contentType: string;
}

export type UploadAssetLinkAPIMessage = {
    message: 'upload';
    uploadRequestId: string;
    tag: 'Asset' | 'Character';
    images: UploadAssetLinkAPIImage[];
}

export type ParseWMLAPIImage = {
    key: string;
    fileName: string;
}

/**
 * @deprecated Checkin/checkout functionality deprecated in favor of new collaboration design
 * Use Suggestions and Publishing APIs instead
 */
export type AssetCheckinAPIMessage = {
    message: 'checkin';
    AssetId: string;
}

/**
 * @deprecated Checkin/checkout functionality deprecated in favor of new collaboration design
 * Use Suggestions and Publishing APIs instead
 */
export type AssetCheckoutAPIMessage = {
    message: 'checkout';
    AssetId: string;
}

export type AssetSubscribeAPIMessage = {
    message: 'subscribe';
}

export type AssetUnsubscribeAPIMessage = {
    message: 'unsubscribe';
}

// Legacy AssetWhoAmIAPIMessage removed - player data now flows through mtw.assets.players data source

type AssetPlayerSettingsAddOnboarding = {
    action: 'addOnboarding';
    values: string[];
}

type AssetPlayerSettingsRemoveOnboarding = {
    action: 'removeOnboarding';
    values: string[];
}

export type AssetPlayerSettingsAPIMessage = {
    message: 'updatePlayerSettings';
    actions: (AssetPlayerSettingsAddOnboarding | AssetPlayerSettingsRemoveOnboarding)[];
}

export type AssetLLMGenerateRequestAPIMessage = {
    message: 'llmGenerate';
    name: string;
}

export type AssetCollaborationStatusAPIMessage = {
    message: 'collaborationStatus';
}

export type AssetAPIMessage = { RequestId?: string; connectionId?: string } & (
    FetchLibraryAPIMessage |
    MetaDataAPIMessage |
    FetchImportsAPIMessage |
    FetchAssetAPIMessage |
    UploadAssetLinkAPIMessage |
    AssetCheckinAPIMessage |
    AssetCheckoutAPIMessage |
    AssetSubscribeAPIMessage |
    AssetUnsubscribeAPIMessage |
    AssetPlayerSettingsAPIMessage |
    AssetLLMGenerateRequestAPIMessage |
    AssetCollaborationStatusAPIMessage
)

export const isFetchLibraryAPIMessage = (message: AssetAPIMessage): message is FetchLibraryAPIMessage => (message.message === 'fetchLibrary')
export const isMetaDataAPIMessage = (message: AssetAPIMessage): message is MetaDataAPIMessage => (message.message === 'metaData')
export const isFetchImportsAPIMessage = (message: AssetAPIMessage): message is FetchImportsAPIMessage => (message.message === 'fetchImports')
export const isFetchAssetAPIMessage = (message: AssetAPIMessage): message is FetchAssetAPIMessage => (message.message === 'fetch')
export const isUploadAssetLinkAPIMessage = (message: AssetAPIMessage): message is UploadAssetLinkAPIMessage => (message.message === 'upload')
/**
 * @deprecated Checkin/checkout functionality deprecated in favor of new collaboration design
 * Use Suggestions and Publishing APIs instead
 */
export const isAssetCheckinAPIMessage = (message: AssetAPIMessage): message is AssetCheckinAPIMessage => (message.message === 'checkin')

/**
 * @deprecated Checkin/checkout functionality deprecated in favor of new collaboration design
 * Use Suggestions and Publishing APIs instead
 */
export const isAssetCheckoutAPIMessage = (message: AssetAPIMessage): message is AssetCheckoutAPIMessage => (message.message === 'checkout')
export const isAssetSubscribeAPIMessage = (message: AssetAPIMessage): message is AssetSubscribeAPIMessage => (message.message === 'subscribe')
export const isAssetUnsubscribeAPIMessage = (message: AssetAPIMessage): message is AssetUnsubscribeAPIMessage => (message.message === 'unsubscribe')
// Legacy isAssetWhoAmIAPIMessage removed - player data now flows through mtw.assets.players data source
export const isAssetPlayerSettingsAPIMessage = (message: AssetAPIMessage): message is AssetPlayerSettingsAPIMessage => (message.message === 'updatePlayerSettings')
export const isAssetLLMGenerateAPIMessage = (message: AssetAPIMessage): message is AssetLLMGenerateRequestAPIMessage => (message.message === 'llmGenerate')
export const isAssetCollaborationStatusAPIMessage = (message: AssetAPIMessage): message is AssetCollaborationStatusAPIMessage => (message.message === 'collaborationStatus')

export type AssetClientPlayerAsset = {
    AssetId: string;
    Story?: boolean;
    instance?: boolean;
}

export type AssetClientPlayerCharacter = {
    CharacterId: EphemeraCharacterId;
    Name: string;
    scopedId?: string;
    fileName?: string;
    fileURL?: string;
    Pronouns?: string;
}

export type AssetClientPlayerSettings = {
    onboardCompleteTags: string[];
    guestName?: string;
    guestId?: string;
}

// Legacy AssetClientPlayerMessage removed - player data now flows through mtw.assets.players data source
// Supporting types (AssetClientPlayerAsset, AssetClientPlayerCharacter, AssetClientPlayerSettings) remain
// as they are still used by other parts of the system

export type AssetClientLibraryMessage = {
    messageType: 'Library';
    RequestId?: string;
    Assets: LibraryAsset[];
    Characters: LibraryCharacter[];
}

export type AssetClientMetaDataMessage = {
    messageType: 'MetaData';
    RequestId?: string;
    AssetId: `ASSET#${string}` | `CHARACTER#${string}`;
    zone: 'Canon' | 'Library' | 'Personal' | 'None';
}

export type AssetClientFetchURL = {
    messageType: 'FetchURL';
    RequestId?: string;
    url: string;
    properties?: Record<string, { fileName: string }>;
}

export type AssetClientUploadURL = {
    messageType: 'UploadURL';
    RequestId?: string;
    url: string;
    s3Object: string;
    images: {
        key: string;
        presignedOutput: string;
        s3Object: string;
    }[];
}

type FetchImportOutputByAsset = {
    assetId: `ASSET#${string}`;
    wml: string;
}

export type AssetClientFetchImports = {
    messageType: 'FetchImports';
    RequestId?: string;
    importsByAsset: FetchImportOutputByAsset[];
}

export type AssetClientParseWML = {
    messageType: 'ParseWML';
    RequestId?: string;
    images: ParseWMLAPIImage[];
}

export type AssetClientLLMGenerate = {
    messageType: 'LLMGenerate';
    RequestId?: string;
    description: string;
    summary: string;
}

export type AssetClientCollaborationStatus = {
    messageType: 'CollaborationStatus';
    RequestId?: string;
    status: {
        phase: 'Bootstrap';
    };
}

// Legacy AssetClientPlayerMessage removed - player data now flows through mtw.assets.players data source
export type AssetClientMessage =
    AssetClientLibraryMessage |
    AssetClientMetaDataMessage |
    AssetClientFetchURL |
    AssetClientUploadURL |
    AssetClientFetchImports |
    AssetClientParseWML |
    AssetClientLLMGenerate |
    AssetClientCollaborationStatus

export const isAssetClientMessage = (message: any): message is AssetClientMessage => {
    if (!('messageType' in message && typeof message.messageType === 'string')) {
        return false
    }
    switch(message.messageType) {
        case 'MetaData':
            return checkAll(
                checkTypes(message, {
                    AssetId: 'string',
                    zone: 'string'
                }),
                typeof message.AssetId === 'string' && isEphemeraAssetId(message.AssetId),
                ['Canon', 'Library', 'Personal', 'None'].includes(message.zone)
            )
        // Legacy 'Player' case removed - player data now flows through mtw.assets.players data source
        case 'Library':
            return checkAll(
                checkTypes(
                    message,
                    {},
                    {
                        RequestId: 'string'
                    }
                ),
                Array.isArray(message.Assets) && checkAll(...message.Assets.map((assetItem: any) => (
                    checkTypes(
                        assetItem,
                        {
                            AssetId: 'string'
                        },
                        {
                            Story: 'boolean',
                            instance: 'boolean'
                        }
                    )
                ))),
                ...message.Characters.map((characterItem: any) => (
                    checkAll(
                        checkTypes(
                            characterItem,
                            {
                                CharacterId: 'string',
                                Name: 'string',
                            },
                            {
                                scopedId: 'string',
                                fileName: 'string',
                                fileURL: 'string',
                                Pronouns: 'string',
                            }
                        )
                    )
                ))
            )
        case 'FetchURL':
            if (!checkTypes(message, { url: 'string' }, { RequestId: 'string' })) {
                return false
            }
            const properties = message.properties
            // properties is optional - if missing, treat as empty object (valid)
            if (properties === undefined || properties === null) {
                return true
            }
            return (typeof properties === 'object') && Object.values(properties).reduce<boolean>((previous, property) => (previous && checkTypes(property, { fileName: 'string' })), true)
        case 'UploadURL':
            return checkTypes(message, { url: 'string', s3Object: 'string' }, { RequestId: 'string' }) &&
                typeof message.images === 'undefined' || (Array.isArray(message.images) && checkAll(...message.images.map((image: any): boolean => (checkTypes(image, { key: 'string', presignedOutput: 'string', s3Object: 'string' })), true)))
        case 'FetchImports':
            return checkAll(
                'importsByAsset' in message,
                Array.isArray(message.importsByAsset) && checkAll(
                    ...message.importsByAsset
                        .map((importMessage: any) => (
                            checkTypes(importMessage, { assetId: 'string', wml: 'string' }) &&
                            importMessage.assetId.split('#')[0] === 'ASSET')
                        )
                )
            )
        case 'ParseWML':
            return checkAll(
                checkTypes(message, {}, { RequestId: 'string' }),
                Array.isArray(message.images) && checkAll(...message.images.map((image: any) => (checkTypes(image, { key: 'string', fileName: 'string' })))),
            )
        case 'LLMGenerate':
            return checkAll(
                checkTypes(message, { description: 'string', summary: 'string' }, { RequestId: 'string' })
            )
        case 'CollaborationStatus':
            return checkAll(
                checkTypes(message, {}, {
                    RequestId: 'string'
                }),
                'status' in message && typeof message.status === 'object',
                checkTypes(message.status, {
                    phase: 'string'
                }),
                ['Bootstrap', 'Storming', 'Normalization', 'Reboot'].includes(message.status.phase)
            )
        default: return false
    }

}