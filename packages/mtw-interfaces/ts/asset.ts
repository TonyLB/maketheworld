import { EphemeraAssetId, EphemeraCharacterId, isEphemeraCharacterId } from "./baseClasses";
import { LibraryAsset, LibraryCharacter } from "./library";
import { FeatureDescribeData, RoomDescribeData, validateTaggedMessageList } from "./messages";
import { checkAll, checkTypes } from "./utils";

export type FetchLibraryAPIMessage = {
    message: 'fetchLibrary';
}

export type FetchImportsAPIMessage = {
    message: 'fetchImports';
    assetId: `ASSET#${string}`;
    keys: string[];
}

export type FetchImportDefaultsAPIMessage = {
    message: 'fetchImportDefaults';
    assetId: `ASSET#${string}`;
    keys: string[];
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

type ParseWMLAPIMessage = {
    message: 'parseWML';
    AssetId: EphemeraCharacterId | EphemeraAssetId;
    uploadName: string;
    images?: ParseWMLAPIImage[];
    create?: boolean;
}

export type AssetCheckinAPIMessage = {
    message: 'checkin';
    AssetId: string;
}

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

export type AssetWhoAmIAPIMessage = {
    message: 'whoAmI';
}

export type AssetAPIMessage = { RequestId?: string } & (
    FetchLibraryAPIMessage |
    FetchImportDefaultsAPIMessage |
    FetchImportsAPIMessage |
    FetchAssetAPIMessage |
    UploadAssetLinkAPIMessage |
    ParseWMLAPIMessage |
    AssetCheckinAPIMessage |
    AssetCheckoutAPIMessage |
    AssetSubscribeAPIMessage |
    AssetUnsubscribeAPIMessage |
    AssetWhoAmIAPIMessage
)

export const isFetchLibraryAPIMessage = (message: AssetAPIMessage): message is FetchLibraryAPIMessage => (message.message === 'fetchLibrary')
export const isFetchImportDefaultsAPIMessage = (message: AssetAPIMessage): message is FetchImportDefaultsAPIMessage => (message.message === 'fetchImportDefaults')
export const isFetchImportsAPIMessage = (message: AssetAPIMessage): message is FetchImportsAPIMessage => (message.message === 'fetchImports')
export const isFetchAssetAPIMessage = (message: AssetAPIMessage): message is FetchAssetAPIMessage => (message.message === 'fetch')
export const isUploadAssetLinkAPIMessage = (message: AssetAPIMessage): message is UploadAssetLinkAPIMessage => (message.message === 'upload')
export const isParseWMLAPIMessage = (message: AssetAPIMessage): message is ParseWMLAPIMessage => (message.message === 'parseWML')
export const isAssetCheckinAPIMessage = (message: AssetAPIMessage): message is AssetCheckinAPIMessage => (message.message === 'checkin')
export const isAssetCheckoutAPIMessage = (message: AssetAPIMessage): message is AssetCheckoutAPIMessage => (message.message === 'checkout')
export const isAssetSubscribeAPIMessage = (message: AssetAPIMessage): message is AssetSubscribeAPIMessage => (message.message === 'subscribe')
export const isAssetUnsubscribeAPIMessage = (message: AssetAPIMessage): message is AssetUnsubscribeAPIMessage => (message.message === 'unsubscribe')
export const isAssetWhoAmIAPIMessage = (message: AssetAPIMessage): message is AssetWhoAmIAPIMessage => (message.message === 'whoAmI')

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
    FirstImpression?: string;
    Pronouns?: {
        subject: string;
        object: string;
        reflexive: string;
        possessive: string;
        adjective: string;
    };
    OneCoolThing?: string;
    Outfit?: string;
}

export type AssetClientPlayerMessage = {
    messageType: 'Player';
    RequestId?: string;
    PlayerName: string;
    CodeOfConductConsent: boolean;
    Assets: AssetClientPlayerAsset[];
    Characters: AssetClientPlayerCharacter[];
}

export type AssetClientLibraryMessage = {
    messageType: 'Library';
    RequestId?: string;
    Assets: LibraryAsset[];
    Characters: LibraryCharacter[];
}

export type AssetClientFetchURL = {
    messageType: 'FetchURL';
    RequestId?: string;
    url: string;
    properties: Record<string, { fileName: string }>;
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

export type AssetClientImportDefaultsRoom = {
    tag: 'Room';
} & Omit<RoomDescribeData, 'RoomId' | 'Characters'>

export type AssetClientImportDefaultsFeature = {
    tag: 'Feature';
} & Omit<FeatureDescribeData, 'FeatureId'>

export type AssetClientImportDefaults = {
    messageType: 'ImportDefaults';
    RequestId?: string;
    assetId: `ASSET#${string}`;
    defaultsByKey: Record<string, AssetClientImportDefaultsRoom | AssetClientImportDefaultsFeature>;
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

//
// TODO: Create AssetClientParseWML message type, and add it to legal AssetClientMessage
//    - Type should return the properties for images that have been added during the parse
//

export type AssetClientParseWML = {
    messageType: 'ParseWML';
    RequestId?: string;
    images: ParseWMLAPIImage[];
}

export type AssetClientMessage = AssetClientPlayerMessage |
    AssetClientLibraryMessage |
    AssetClientFetchURL |
    AssetClientUploadURL |
    AssetClientImportDefaults |
    AssetClientFetchImports |
    AssetClientParseWML

export const isAssetClientMessage = (message: any): message is AssetClientMessage => {
    if (!('messageType' in message && typeof message.messageType === 'string')) {
        return false
    }
    switch(message.messageType) {
        case 'Player':
            return checkAll(
                checkTypes(message, {
                    PlayerName: 'string'
                },
                {
                    RequestId: 'string'
                }),
                ...message.Assets.map((assetItem) => (
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
                )),
                ...message.Characters.map((characterItem) => (
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
                                FirstImpression: 'string',
                                OneCoolThing: 'string',
                                Outfit: 'string'
                            }
                        ),
                        !message.Pronouns || checkTypes(message.Pronouns, {
                            subject: 'string',
                            object: 'string',
                            possessive: 'string',
                            adjective: 'string',
                            reflexive: 'string'
                        })
                    ) && isEphemeraCharacterId(characterItem.CharacterId)
                ))
            )
        case 'Library':
            return checkAll(
                checkTypes(
                    message,
                    {},
                    {
                        RequestId: 'string'
                    }
                ),
                ...message.Assets.map((assetItem) => (
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
                )),
                ...message.Characters.map((characterItem) => (
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
                                FirstImpression: 'string',
                                OneCoolThing: 'string',
                                Outfit: 'string'
                            }
                        ),
                        !message.Pronouns || checkTypes(message.Pronouns, {
                            subject: 'string',
                            object: 'string',
                            possessive: 'string',
                            adjective: 'string',
                            reflexive: 'string'
                        })
                    )
                ))
            )
        case 'FetchURL':
            if (!checkTypes(message, { url: 'string' }, { RequestId: 'string' })) {
                return false
            }
            const properties = message.properties
            return (typeof properties === 'object') && Object.values(properties).reduce<boolean>((previous, property) => (previous && checkTypes(property, { fileName: 'string' })), true)
        case 'UploadURL':
            return checkTypes(message, { url: 'string', s3Object: 'string' }, { RequestId: 'string' }) &&
                ("images" in message && Array.isArray(message.images) && message.images.reduce((previous, item) => (previous && checkTypes(item, { key: 'string', presignedOutput: 'string', s3Object: 'string' })), true))
        case 'ImportDefaults':
            return checkAll(
                checkTypes(message, { assetId: 'string' }),
                ...Object.values(message.defaultsByKey || {}).map((item: any) => (
                    ['Room', 'Feature'].includes(item.tag) && validateTaggedMessageList(item.Name) && validateTaggedMessageList(item.Description)
                ))
            ) && message.assetId.split('#')[0] === 'ASSET'
        case 'FetchImports':
            return checkAll(
                'importsByAsset' in message,
                Array.isArray(message.importsByAsset),
                ...message.importsByAsset.map((importMessage) => (checkTypes(importMessage, { assetId: 'string', wml: 'string' })) &&
                importMessage.assetId.split('#')[0] === 'ASSET'))
        case 'ParseWML':
            return checkAll(
                checkTypes(message, {}, { RequestId: 'string' }),
                ...message.images.map((image) => (checkTypes(image, { key: 'string', fileName: 'string' })))
            )
        default: return false
    }

}