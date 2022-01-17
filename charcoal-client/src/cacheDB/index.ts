import Dexie from 'dexie'

import { Message } from '../slices/messages/baseClasses'

type TextEntryLinesType = {
    key: 'TextEntryLines';
    value: number;
}

type ShowNeighborhoodHeadersType = {
    key: 'ShowNeighborhoodHeaders';
    value: boolean;
}

type LastSyncType = {
    key: 'LastSync';
    value: number;
}

export type ClientSettingType = TextEntryLinesType | ShowNeighborhoodHeadersType | LastSyncType

class ClientCache extends Dexie {

    messages!: Dexie.Table<Message, string>;
    clientSettings!: Dexie.Table<ClientSettingType, string>;

    constructor() {
        super("ClientCache")
        this.version(1).stores({
            clientSettings: 'key,value'
        })
        this.version(2).stores({
            neighborhoods: 'PermanentId',
            maps: 'MapId',
            settings: 'key,value',
            backups: 'PermanentId',
            rooms: 'PermanentId',
            characters: 'CharacterId',
            grants: '[CharacterId+Resource]',
            exits: '[FromRoomId+ToRoomId]',
            roles: 'RoleId'
        })
        this.version(3).stores({
            messages: 'MessageId,CreatedTime,Target'
        })
        
    }
}

export var cacheDB = new ClientCache()
export default cacheDB