import Dexie from 'dexie'

export var cacheDB = new Dexie('maketheworlddb')
cacheDB.version(1).stores({
    clientSettings: 'key,value'
})

export default cacheDB