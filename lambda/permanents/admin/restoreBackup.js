const { documentClient, s3Client, graphqlClient, gql } = require('utilities')
const { gqlOutput } = require('gqlOutput')

const s3Get = (filename) => {
    const request = {
        Bucket: process.env.S3_BUCKET,
        Key: filename
    }
    return s3Client.getObject(request).promise()
}

const pendingGQL = ({PermanentId }) => (gql`mutation PendingBackup {
    putBackup (PermanentId: "${PermanentId}", Status: "Restoring...") {
        ${gqlOutput}
    }
}`)

const completedGQL = ({PermanentId}) => (gql`mutation PendingBackup {
    putBackup (PermanentId: "${PermanentId}", Status: "Restored.") {
        ${gqlOutput}
    }
}`)

//
// Deserialize a backup file's format into database format.
//
const deserialize = ({ Neighborhoods = [], Rooms = [], Players = [], Maps = [] }) => {
    const PlayerAdds = Object.values(Players)
        .map(({
            PlayerName,
            Characters,
            ...rest
        }) => {
            return [
                {
                    PutRequest: {
                        Item: {
                            PermanentId: `PLAYER#${PlayerName}`,
                            DataCategory: 'Details',
                            ...rest
                        }
                    }
                },
                ...((Characters || [])
                    .map(({ CharacterId, Grants = [], ...rest }) => ([{
                        PutRequest: {
                            Item: {
                                PermanentId: `PLAYER#${PlayerName}`,
                                DataCategory: `CHARACTER#${CharacterId}`,
                            }
                        }
                    },
                    {
                        PutRequest: {
                            Item: {
                                PermanentId: `CHARACTER#${CharacterId}`,
                                DataCategory: 'Details',
                                ...rest
                            }
                        }
                    },
                    ...(Grants.map(({ Resource, Actions, Roles }) => ({
                        PutRequest: {
                            Item: {
                                PermanentId: `CHARACTER#${CharacterId}`,
                                DataCategory: `GRANT#${Resource}`,
                                ...(Actions ? { Actions } : {}),
                                ...(Roles ? { Roles } : {}),
                            }
                        }
                    })))
                    ]))
                    .reduce((previous, putList) => ([...previous, ...putList]), [])
                )
             ]
        })
        .reduce((previous, putList) => ([...previous, ...putList]), [])
    const NeighborhoodAdds = Object.values(Neighborhoods)
        .map(({
            PermanentId,
            ParentId,
            Description,
            Visibility = 'Private',
            Topology = 'Dead-End',
            ContextMapId,
            Retired,
            Name
        }) => {
            return {
                PutRequest: {
                    Item: {
                        PermanentId: `NEIGHBORHOOD#${PermanentId}`,
                        DataCategory: 'Details',
                        Name,
                        Description,
                        ParentId,
                        Visibility,
                        Topology,
                        ContextMapId,
                        ...(Retired ? { Retired: 'RETIRED' } : {})
                    }
                }
            }
        })
    const MapAdds = Object.values(Maps)
        .map(({
            PermanentId,
            Name,
            Rooms = []
        }) => {
            return [{
                    PutRequest: {
                        Item: {
                            PermanentId: `MAP#${PermanentId}`,
                            DataCategory: 'Details',
                            Name
                        }
                    }
                },
                ...(Rooms.map(({ RoomId, ...rest }) => ({
                    PutRequest: {
                        Item: {
                            PermanentId: `MAP#${PermanentId}`,
                            DataCategory: `ROOM#${RoomId}`,
                            ...rest
                        }
                    }
                }))),
            ]
        })
        .reduce((previous, putList) => ([...previous, ...putList]), [])
    const RoomAdds = Object.values(Rooms)
        .map(({
            PermanentId,
            ParentId,
            Name,
            Description,
            Visibility = 'Public',
            Retired = ''
        }) => {
            return {
                PutRequest: {
                    Item: {
                        PermanentId: `ROOM#${PermanentId}`,
                        DataCategory: 'Details',
                        Name,
                        Description,
                        ParentId,
                        Visibility,
                        ...(Retired ? { Retired: 'RETIRED' } : {})
                    }
                }
            }
        })
    const EntryAdds = Object.values(Rooms)
        .map(({ Entries }) => (Entries.map(({
                ParentId,
                Name,
                FromRoomId
            }) => ({
                PutRequest: {
                    Item: {
                        PermanentId: `ROOM#${ParentId}`,
                        DataCategory: `ENTRY#${FromRoomId}`,
                        Name: Name
                    }
                }
            }))
        ))
        .reduce((previous, entries) => ([ ...previous, ...entries ]), [])
    const ExitAdds = Object.values(Rooms)
        .map(({ Exits }) => (Exits.map(({
                ParentId,
                Name,
                FromRoomId
            }) => {
                return {
                    PutRequest: {
                        Item: {
                            PermanentId: `ROOM#${FromRoomId}`,
                            DataCategory: `EXIT#${ParentId}`,
                            Name: Name
                        }
                    }
                }
            })
        ))
        .reduce((previous, entries) => ([ ...previous, ...entries ]), [])
    return [
        ...PlayerAdds,
        ...NeighborhoodAdds,
        ...MapAdds,
        ...RoomAdds,
        ...EntryAdds,
        ...ExitAdds
    ]
}

const batchDispatcher = (items) => {
    const groupBatches = items.reduce((({ current, requestLists }, item) => {
            if (current.length > 23) {
                return {
                    requestLists: [ ...requestLists, current ],
                    current: [item]
                }
            }
            else {
                return {
                    requestLists,
                    current: [...current, item]
                }
            }
        }), { current: [], requestLists: []})
    const batchPromises = [...groupBatches.requestLists, groupBatches.current]
        .map((itemList) => (documentClient.batchWrite({ RequestItems: {
            [`${process.env.TABLE_PREFIX}_permanents`]: itemList
        } }).promise()))
    return Promise.all(batchPromises)
}

exports.restoreBackup = async ({ PermanentId }) => {

    const objectName = `backups/${PermanentId}.json`
    if (!objectName) {
        return { statusCode: 500, body: 'No objectName provided'}
    }

    await graphqlClient.mutate({ mutation: pendingGQL({ PermanentId }) })

    await s3Get(objectName)
        .then(({ Body }) => Body)
        .then((Body) => Body.toString('utf-8'))
        .then((content) => (JSON.parse(content)))
        .then(deserialize)
        .then(batchDispatcher)

    return graphqlClient.mutate({ mutation: completedGQL({ PermanentId }) })
        .then(() => ({ statusCode: 200, body: 'Restore complete.' }))

}
