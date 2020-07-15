import Dexie from 'dexie'

export var cacheDB = new Dexie('maketheworlddb')
cacheDB.version(1).stores({
    clientSettings: 'key,value',
    neighborhoods: 'PermanentId',
    maps: 'MapId',
    settings: 'key,value',
    backups: 'PermanentId',
    rooms: 'PermanentId',
    characters: 'CharacterId',
    grants: '[CharacterId+Resource]',
    exits: '[FromRoomId+ToRoomId]'
})

export default cacheDB