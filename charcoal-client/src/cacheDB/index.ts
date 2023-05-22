import Dexie, { Transaction } from 'dexie'

import { Message } from '@tonylb/mtw-interfaces/dist/messages'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses';

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

export type ClientSettingType = TextEntryLinesType | ShowNeighborhoodHeadersType | AlwaysShowOnboardingType | LastSyncType

export type CharacterSyncType = {
    CharacterId: EphemeraCharacterId;
    lastSync: number;
}

class ClientCache extends Dexie {

    messages!: Dexie.Table<Message, string>;
    clientSettings!: Dexie.Table<ClientSettingType, string>;
    characterSync!: Dexie.Table<CharacterSyncType, EphemeraCharacterId>;

    constructor() {
        super("maketheworlddb")
        this.version(1).stores({
            clientSettings: 'key,value',
            messages: 'MessageId,CreatedTime,Target',
            characterSync: 'CharacterId'
        })
    }
}

export var cacheDB = new ClientCache()
export default cacheDB