const { documentClient } = require('./utilities')

const { TABLE_PREFIX } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`
const deltaTable = `${TABLE_PREFIX}_permanent_delta`

const stripType = (value) => value.split('#').slice(1).join('#')

const deserialize = ({ PermanentId: rawPermanentId, DataCategory, ...rest }) => {
    const dataType = rawPermanentId.split('#')[0]
    const PermanentId = stripType(rawPermanentId)
    switch (dataType) {

        case 'CHARACTER':
            if (DataCategory === 'Details') {
                return { Character:
                    {
                        CharacterId: PermanentId,
                        ...rest
                    }
                }
            }
            if (DataCategory.startsWith('GRANT#')) {
                const Resource = stripType(DataCategory)
                const Actions = rest.Actions
                const Roles = rest.Roles
                return (Actions || Roles)
                    ? { Grant:
                        {
                            CharacterId: PermanentId,
                            Resource,
                            Actions,
                            Roles
                        }
                    }
                    : null
            }
            return null

        case 'ADMIN':
            if (DataCategory === 'Details') {
                return { Settings: rest }
            }
            if (DataCategory.startsWith('ROLE#')) {
                const RoleId = stripType(DataCategory)
                return { Role:
                    {
                        RoleId,
                        Name: rest.Name,
                        Actions: rest.Actions
                    }
                }
            }
            if (DataCategory.startsWith('BACKUP#')) {
                const PermanentId = stripType(DataCategory)
                return { Backup:
                    {
                        PermanentId,
                        Name: rest.Name,
                        Description: rest.Description,
                        Status: rest.Status
                    }
                }
            }
            return null

        case 'ROOM':
            if (DataCategory === 'Details') {
                const { ParentId, Name, Description, Visibility, Topology, Retired } = rest
                return { Room:
                    {
                        PermanentId,
                        ParentId,
                        Name,
                        Description,
                        Visibility: Visibility || 'Public',
                        Topology,
                        Retired: (Retired === 'RETIRED')
                    }
                }
            }
            if (DataCategory.startsWith('EXIT#')) {
                const ToRoomId = stripType(DataCategory)
                return { Exit:
                    {
                        FromRoomId: PermanentId,
                        ToRoomId,
                        Name: rest.Name
                    }
                }
            }
            return null

        case 'NEIGHBORHOOD':
            if (DataCategory === 'Details') {
                const { ParentId, Name, Description, Visibility, Topology, Retired, ContextMapId } = rest
                return { Neighborhood:
                    {
                        PermanentId,
                        ParentId,
                        Name,
                        Description,
                        Visibility: Visibility || 'Private',
                        Topology,
                        Retired: (Retired === 'RETIRED'),
                        ContextMapId
                    }
                }
            }
            return null

        case 'MAP':
            if (DataCategory === 'Details') {
                const { Name, Rooms } = rest
                return { Map:
                    {
                        MapId: PermanentId,
                        Name,
                        Rooms: Rooms.map(({ PermanentId, X, Y, Locked = false }) => ({ PermanentId, X, Y, Locked }))
                    }
                }
            }
            return null

        default: return null
    }
}

const syncRecords = ({ startingAt }) => {
    if (!startingAt) {
        return []
    }
    const epochTime = Date.now()
    const startPartition = Math.floor(Math.min(startingAt, epochTime) / 10000000)
    const endPartition = Math.floor(Math.max(epochTime, startingAt) / 10000000)
    const partitionIds = Array.from(Array(1 + endPartition - startPartition), (_, index) => (index + startPartition))
    return Promise.all(partitionIds.map((partitionId) => (documentClient.query({
        TableName: deltaTable,
        ...(partitionId === startPartition
            ? {
                KeyConditionExpression: "PartitionId = :Partition and DeltaId >= :Start",
                ExpressionAttributeValues: {
                    ":Partition": partitionId,
                    ":Start": `${startingAt}`
                }
            }
            : {
                KeyConditionExpression: "PartitionId = :Partition",
                ExpressionAttributeValues: {
                    ":Partition": partitionId
                }
            }
        )
    }).promise())))
        .then((partitions) => (partitions
            .reduce((previous, partition) => ([ ...previous, ...(partition.Items || []) ]), [])))
        .then((items) => (items
            .map(({ RowId = '', PartitionId, DeltaId, ...rest }) => {
                const [PermanentId, DataCategory] = RowId.split('::')
                return {
                    PermanentId,
                    DataCategory,
                    ...rest
                }
            })))
        .then((items) => (items.filter(({ PermanentId, DataCategory }) => (PermanentId && DataCategory))))
        .then((Items) => ({ Items }))

}

exports.syncRecords = syncRecords

exports.sync = async ({ startingAt = null }) => {
    const { Items = [] } = await (startingAt
        ? syncRecords({ startingAt })
        : documentClient.scan({
            TableName: permanentTable
        }).promise())

    return Items.map(deserialize).filter((value) => (value))

}
