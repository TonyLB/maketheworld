import Dexie from 'dexie'

import { Message } from '@tonylb/mtw-interfaces/ts/messages'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import { AssetUUID } from '@tonylb/mtw-base/ts/schema';

export type TextEntryLinesType = {
    key: 'TextEntryLines';
    value: number;
}

export type ShowNeighborhoodHeadersType = {
    key: 'ShowNeighborhoodHeaders';
    value: boolean;
}

export type AlwaysShowOnboardingType = {
    key: 'AlwaysShowOnboarding';
    value: boolean;
}

export type LastSyncType = {
    key: 'LastSync';
    value: Record<string, number>;
}

export type CurrentCharacterIdType = {
    key: 'CurrentCharacterId';
    value: EphemeraCharacterId | null;
}

export type CurrentAssetIdType = {
    key: 'CurrentAssetId';
    value: AssetUUID | null;
}

export type ClientSettingType = TextEntryLinesType | ShowNeighborhoodHeadersType | AlwaysShowOnboardingType | LastSyncType | CurrentCharacterIdType | CurrentAssetIdType

export type CharacterSyncType = {
    CharacterId: EphemeraCharacterId;
    lastSync: number;
}

/** Cached message row: server Message plus Dexie primary key `deltaPk` (see makeMessageDeltaPk). */
export type CachedMessage = Message & { deltaPk: string }

class ClientCache extends Dexie {

    messages!: Dexie.Table<CachedMessage, string>;
    clientSettings!: Dexie.Table<ClientSettingType, string>;
    characterSync!: Dexie.Table<CharacterSyncType, EphemeraCharacterId>;

    constructor() {
        super("maketheworlddb")
        this.version(1).stores({
            clientSettings: 'key,value',
            messages: 'MessageId,CreatedTime,Target',
            characterSync: 'CharacterId'
        })
        this.version(2).stores({
            clientSettings: 'key,value',
            messages: 'deltaPk, Target, MessageId, CreatedTime',
            characterSync: 'CharacterId'
        })
    }
}

export var cacheDB = new ClientCache()
export default cacheDB

export { makeMessageDeltaPk, stripMessageDeltaPk } from './makeMessageDeltaPk'