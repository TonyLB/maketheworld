import Dexie, { Transaction } from 'dexie'

import { Message } from '@tonylb/mtw-interfaces/dist/messages'

export type TextEntryLinesType = {
    key: 'TextEntryLines';
    value: number;
}

export type ShowNeighborhoodHeadersType = {
    key: 'ShowNeighborhoodHeaders';
    value: boolean;
}

export type LastSyncType = {
    key: 'LastSync';
    value: Record<string, number>;
}

export type ClientSettingType = TextEntryLinesType | ShowNeighborhoodHeadersType | LastSyncType

class ClientCache extends Dexie {

    messages!: Dexie.Table<Message, string>;
    clientSettings!: Dexie.Table<ClientSettingType, string>;

    constructor() {
        super("maketheworlddb")
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
        this.version(4).stores({
            neighborhoods: null,
            maps: null,
            settings: null,
            backups: null,
            rooms: null,
            characters: null,
            grants: null,
            exits: null,
            roles: null
        }).upgrade((db: Transaction) => {
            //
            // Because of the danger of previous data in a different format,
            // we clear the messages table on update and flag it to resync from
            // the back-end
            //
            db.table("messages").clear()
            db.table("clientSettings").where("key").equals("LastSync").delete()
        })
        //
        // Remove obsolete keys in clientSettings
        //
        this.clientSettings.where("key").startsWith("LastMessageSync").delete()
    }
}

export var cacheDB = new ClientCache()
export default cacheDB