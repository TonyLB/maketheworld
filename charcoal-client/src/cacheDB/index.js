import Dexie from 'dexie'

export var cacheDB = new Dexie('maketheworlddb')
cacheDB.version(1).stores({
    clientSettings: 'key,value'
})
cacheDB.version(2).stores({
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

export default cacheDB