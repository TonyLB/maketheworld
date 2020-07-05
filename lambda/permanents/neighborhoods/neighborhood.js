// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { v4: uuidv4 } = require('/opt/uuid')
const { graphqlClient, documentClient, gql } = require('../utilities')

const promiseDebug = (label) => (result) => {
    console.log(`${label}: ${JSON.stringify(result, null, 4)}`)
    return result
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
        .filter((itemList) => (itemList.length))
        .map((itemList) => (documentClient.batchWrite({ RequestItems: {
            [`${process.env.TABLE_PREFIX}_permanents`]: itemList
        } }).promise()))
    return Promise.all(batchPromises)
}

exports.getNeighborhood = ({ PermanentId }) => {
    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const neighborhoodLookup = documentClient.get({
        TableName: permanentTable,
        Key: {
            PermanentId: `NEIGHBORHOOD#${PermanentId}`,
            DataCategory: 'Details'
        }
    }).promise()
    .then(({ Item = {} }) => (Item))
    .then((neighborhood) => (documentClient.query({
            TableName: permanentTable,
            KeyConditionExpression: 'DataCategory = :Category',
            ExpressionAttributeValues: {
                ":Category": `GRANT#${PermanentId}`
            },
            IndexName: "DataCategoryIndex"
        }).promise()
        .then(({ Items = [] }) => (Items.map(({ PermanentId: CharacterId, Actions, Roles }) => ({
            CharacterId: (CharacterId || '').split('#').slice(1).join('#'),
            Actions,
            Roles
        }))))
        .then((Grants) => ({ ...neighborhood, Grants }))
    ))
    .then(({ ParentId, Name, Description, Visibility = 'Private', Topology = 'Dead-End', Retired = '', ContextMapId, Grants }) => ({
        PermanentId,
        ParentId,
        Name,
        Description,
        Visibility,
        Topology,
        ContextMapId,
        Grants,
        Retired: (Retired === 'RETIRED')
    }))

    return neighborhoodLookup
}

exports.putNeighborhood = (event) => {

    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const { CharacterId = '', PermanentId = '', ParentId = '', Description = '', Visibility = 'Private', Topology = 'Dead-End', Retired = false, ContextMapId, Grants = [], Name } = event.arguments

    const newNeighborhood = !Boolean(PermanentId)
    const newPermanentId = PermanentId || uuidv4()

    //
    // Create externalUpdate calls to update the AppSync API with what we're doing to grants (so people
    // can subscribe to the updates of their own grants, and get live permission changes)
    //
    const updateGrantsInAppSyncCall = ({ grantsToDelete, grantsToPut }) => {
        const findPlayer = (CharacterId) => (
            documentClient.query({
                TableName: permanentTable,
                KeyConditionExpression: 'DataCategory = :CharacterId',
                ExpressionAttributeValues: {
                    ":CharacterId": `CHARACTER#${CharacterId}`
                },
                IndexName: "DataCategoryIndex"

            }).promise()
                .then(({ Items }) => ((Items && Items.length && Items[0]) || { PermanentId: 'PLAYER#'}))
                .then(({ PermanentId }) => (PermanentId && PermanentId.slice(7)))
        )
        return Promise.all([
            ...(grantsToDelete.map(({ CharacterId, Resource }) => (
                    findPlayer(CharacterId).then((PlayerName) => {
                        if (!PlayerName) {
                            return ''
                        }
                        return `externalUpdateGrant (
                            PlayerName: ${JSON.stringify(PlayerName)},
                            CharacterId: "${CharacterId}",
                            Type: "REVOKE",
                            Grant: {
                                CharacterId: "${CharacterId}",
                                Resource: "${Resource}"
                            }
                        ) {
                            Type
                            PlayerName
                            PlayerInfo {
                              PlayerName
                              CodeOfConductConsent
                            }
                            CharacterInfo {
                              PlayerName
                              Name
                              CharacterId
                              Pronouns
                              FirstImpression
                              Outfit
                              OneCoolThing
                              HomeId
                            }
                            GrantInfo {
                              CharacterId
                              Resource
                              Actions
                              Roles
                            }
                        }`
                    })
                ))),
                ...(grantsToPut.map(({ CharacterId, Resource, Roles = '', Actions = '' }) => (
                    findPlayer(CharacterId).then((PlayerName) => {
                        if (!PlayerName) {
                            return ''
                        }
                        return `externalUpdateGrant (
                            PlayerName: ${JSON.stringify(PlayerName)},
                            CharacterId: "${CharacterId}",
                            Type: "GRANT",
                            Grant: {
                                CharacterId: "${CharacterId}",
                                Resource: "${Resource}",
                                Roles: ${JSON.stringify(Roles)},
                                Actions: ${JSON.stringify(Actions)}
                            }
                        ) {
                            Type
                            PlayerName
                            PlayerInfo {
                              PlayerName
                              CodeOfConductConsent
                            }
                            CharacterInfo {
                              PlayerName
                              Name
                              CharacterId
                              Pronouns
                              FirstImpression
                              Outfit
                              OneCoolThing
                              HomeId
                            }
                            GrantInfo {
                              CharacterId
                              Resource
                              Actions
                              Roles
                            }
                        }`
                    })
                )))
        ]).then((Items) => (Items.filter((item) => (item)).reduce((previous, item, index) => (
                `${previous}\nupdate${index+1}: ${item}`
            ), '')))
            .then((aggregateUpdates) => (aggregateUpdates.trim().length ? `mutation GrantUpdates { ${aggregateUpdates} }` : ''))
            .then((mutation) => (
                mutation.trim().length
                    ? graphqlClient.mutate({ mutation: gql`${mutation}`})
                    : {}
            ))
            .then(() => ({ grantsToDelete, grantsToPut }))
    }

    const newGrants = newNeighborhood
        ? [
            ...Grants.filter(({ CharacterId: grantCharacterId }) => (grantCharacterId !== CharacterId)),
            {
                CharacterId,
                Resource: newPermanentId,
                Roles: 'EDITOR'
            }
        ]
        : Grants

    const updateGrants = (newNeighborhood
            ? Promise.resolve([])
            : documentClient.query({
                TableName: permanentTable,
                KeyConditionExpression: 'DataCategory = :GrantId',
                ExpressionAttributeValues: {
                    ":GrantId": `GRANT#${newPermanentId}`
                },
                IndexName: "DataCategoryIndex"
            }).promise()
            .then(({ Items }) => (Items || []))
            .then((Items) => (Items.map(({ PermanentId, DataCategory, ...rest }) => ({
                CharacterId: PermanentId.split('#').slice(1).join('#'),
                ...rest
            }))))
        )
        .then((OldGrants) => ({
            grantsToDelete: OldGrants
                .filter(({ CharacterId }) => (!newGrants.find((grant) => (CharacterId === grant.CharacterId))))
                .map((item) => ({ ...item, Resource: newPermanentId })),
            grantsToPut: newGrants.filter(({ CharacterId, Roles, Actions }) => (!OldGrants.find((oldGrant) => (
                    CharacterId === oldGrant.CharacterId &&
                    ((Actions === oldGrant.Actions) || (!Actions && !oldGrant.Actions)) &&
                    ((Roles === oldGrant.Roles) || (!Roles && !oldGrant.Roles))
                ))))
                .map((item) => ({ ...item, Resource: newPermanentId }))
            }))
        .then(updateGrantsInAppSyncCall)
        .then(({ grantsToDelete, grantsToPut }) => ([
                ...(grantsToDelete.map(({ Resource, CharacterId }) => ({
                    DeleteRequest: {
                        Key: {
                            PermanentId: `CHARACTER#${CharacterId}`,
                            DataCategory: `GRANT#${Resource}`
                        }
                    }
                }))),
                ...(grantsToPut.map(({ CharacterId, Resource, Roles, Actions }) => ({
                    PutRequest: {
                        Item: {
                            PermanentId: `CHARACTER#${CharacterId}`,
                            DataCategory: `GRANT#${Resource}`,
                            ...(Roles ? { Roles } : {} ),
                            ...(Actions ? { Actions } : {} ),
                        }
                    }
                })))
            ]))
        .then(batchDispatcher)
        .then(() => ({
            CharacterId,
            PermanentId: newPermanentId,
            Grants: newGrants,
            ParentId,
            Description,
            Visibility,
            Topology,
            Retired,
            ContextMapId,
            Name
        }))

    const putNeighborhood = ({
        PermanentId,
        ParentId,
        Name,
        Description,
        Visibility = 'Private',
        Topology = 'Dead-End',
        ContextMapId,
        Grants = [],
        Retired = false
    }) => (documentClient.put({
            TableName: permanentTable,
            Item: {
                PermanentId: `NEIGHBORHOOD#${PermanentId}`,
                DataCategory: 'Details',
                ...(ParentId ? { ParentId } : {}),
                Name,
                ...(Description ? { Description } : {}),
                ...(Visibility ? { Visibility } : {}),
                ...(Topology ? { Topology } : {}),
                ...(ContextMapId ? { ContextMapId } : {}),
                ...(Retired ? { Retired: 'RETIRED' } : {})
            },
            ReturnValues: "ALL_OLD"
        }).promise()
            .then((old) => ((old && old.Attributes) || {}))
            .then(({ DataCategory, ...rest }) => ({
                ...rest,
                PermanentId,
                ParentId,
                Name,
                Description,
                Visibility,
                Topology,
                ContextMapId,
                Grants,
                Retired
            }))
    )

    return updateGrants
        .then(putNeighborhood)
        .then(({
            PermanentId,
            ParentId,
            Name,
            Description,
            Visibility,
            Topology,
            ContextMapId,
            Grants,
            Retired
        }) => ([{
            Neighborhood: {
                PermanentId,
                ParentId,
                Name,
                Description,
                Visibility,
                Topology,
                ContextMapId,
                Grants,
                Retired
            },
            Room: null,
            Map: null
        }]))
        .catch((err) => {
            console.log(`ERROR:`)
            console.log(err)
            return { error: err.stack }
        })

}
