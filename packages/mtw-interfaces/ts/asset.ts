import { LibraryAsset, LibraryCharacter } from "./library";
import { checkAll, checkTypes } from "./utils";

export type FetchLibraryAPIMessage = {
    message: 'fetchLibrary';
}

export type FetchAssetAPIMessage = {
    message: 'fetch';
    AssetId?: string;
    fileName?: string;
}

export type UploadAssetLinkAPIMessage = {
    message: 'upload';
    uploadRequestId: string;
    tag: 'Asset' | 'Character';
    fileName: string;
}

export type UploadImageLinkAPIMessage = {
    message: 'uploadImage';
    uploadRequestId: string;
    tag: 'Character' | 'Map';
    fileExtension: string;
}

type ParseWMLAPIMessagePersonal = {
    message: 'parseWML';
    uploadName: string;
    fileName: string;
    subFolder?: string;
    zone: 'Personal';
    player?: string;
}

type ParseWMLAPIMessageImpersonal = {
    message: 'parseWML';
    uploadName: string;
    fileName: string;
    subFolder?: string;
    zone: 'Canon' | 'Library';
}

export type ParseWMLAPIMessage = ParseWMLAPIMessagePersonal | ParseWMLAPIMessageImpersonal

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

export type AssetAPIMessage = { RequestId?: string } & (
    FetchLibraryAPIMessage |
    FetchAssetAPIMessage |
    UploadAssetLinkAPIMessage |
    UploadImageLinkAPIMessage |
    ParseWMLAPIMessage |
    AssetCheckinAPIMessage |
    AssetCheckoutAPIMessage |
    AssetSubscribeAPIMessage
)

export const isFetchLibraryAPIMessage = (message: AssetAPIMessage): message is FetchLibraryAPIMessage => (message.message === 'fetchLibrary')
export const isFetchAssetAPIMessage = (message: AssetAPIMessage): message is FetchAssetAPIMessage => (message.message === 'fetch')
export const isUploadAssetLinkAPIMessage = (message: AssetAPIMessage): message is UploadAssetLinkAPIMessage => (message.message === 'upload')
export const isUploadImageLinkAPIMessage = (message: AssetAPIMessage): message is UploadImageLinkAPIMessage => (message.message === 'uploadImage')
export const isParseWMLAPIMessage = (message: AssetAPIMessage): message is ParseWMLAPIMessage => (message.message === 'parseWML')
export const isAssetCheckinAPIMessage = (message: AssetAPIMessage): message is AssetCheckinAPIMessage => (message.message === 'checkin')
export const isAssetCheckoutAPIMessage = (message: AssetAPIMessage): message is AssetCheckoutAPIMessage => (message.message === 'checkout')
export const isAssetSubscribeAPIMessage = (message: AssetAPIMessage): message is AssetSubscribeAPIMessage => (message.message === 'subscribe')

export type AssetClientPlayerAsset = {
    AssetId: string;
    Story?: boolean;
    instance?: boolean;
}

export type AssetClientPlayerCharacter = {
    CharacterId: string;
    Name: string;
    scopedId: string;
    fileName: string;
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

export type AssetClientMessage = AssetClientPlayerMessage |
    AssetClientLibraryMessage

export const isAssetClientMessage = (message: any): message is AssetClientMessage => {
    if (!('messageType' in message && typeof message.messageType === 'string')) {
        return false
    }
    switch(message.messageType) {
        case 'Player':
            return checkAll(
                checkTypes(message, {
                    CharacterId: 'string',
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
                                scopedId: 'string',
                                fileName: 'string'
                            },
                            {
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
                                scopedId: 'string',
                                fileName: 'string'
                            },
                            {
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
        default: return false
    }

}