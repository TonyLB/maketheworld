// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('/opt/uuid')
const { AppSync, gql } = require('/opt/appsync')
require('cross-fetch/polyfill')

const graphqlClient = new AppSync.AWSAppSyncClient({
    url: process.env.APPSYNC_ENDPOINT_URL,
    region: process.env.AWS_REGION,
    auth: {
      type: 'AWS_IAM',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN
      }
    },
    disableOffline: true
  })

const promiseDebug = (label) => (result) => {
    console.log(`${label}: ${JSON.stringify(result, null, 4)}`)
    return result
}

const batchDispatcher = (documentClient) => (items) => {
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

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

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
    .then(({ PermanentId: FetchedPermanentId, ParentId, Name, Description, Visibility, Topology, ContextMapId, Grants }) => ({
        PermanentId,
        ParentId,
        Name,
        Description,
        Visibility,
        Topology,
        ContextMapId,
        Grants
    }))

    return neighborhoodLookup
}

exports.putNeighborhood = (event) => {

    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    const { CharacterId = '', PermanentId = '', ParentId = '', Description = '', Visibility = 'Visible', Topology = 'Dead-End', ContextMapId, Grants = [], Name } = event.arguments

    const newNeighborhood = !Boolean(PermanentId)
    const newPermanentId = PermanentId || uuidv4()

    //
    // First check the existing Neighborhood to grab calculated values if they
    // already exist, and see whether this update involves a change of parentage
    // (which will require cascade updates)
    //
    const preCheckLookup = newNeighborhood
        ? Promise.resolve({
            CharacterId,
            PermanentId: newPermanentId,
            ParentId,
            Name,
            Description,
            Visibility,
            Topology,
            ContextMapId,
            Grants
        })
        : documentClient.get({
                TableName: permanentTable,
                Key: {
                    PermanentId: `NEIGHBORHOOD#${newPermanentId}`,
                    DataCategory: 'Details'
                }
            }).promise()
            .then(({ Item = {} }) => (Item))
            .then(({ ParentId: FetchedParentId, Ancestry, ProgenitorId, ...rest }) => ({
                ...rest,
                PermanentId: newPermanentId,
                ParentId,
                Name,
                Description,
                Visibility,
                Topology,
                ContextMapId,
                Grants,
                PreviousParentId: FetchedParentId,
                PreviousAncestry: Ancestry,
                PreviousProgenitorId: ProgenitorId
            }))

    //
    // Next, if there is a change of parent then find the new parent (if any) in the
    // database and derive the new Progenitor and Ancestry
    //
    const ancestryLookup = ({
            ParentId,
            PermanentId,
            ...rest
        }) =>
        (ParentId
            ? (ParentId !== rest.PreviousParentId)
                //
                // On change of parent, get the new parent and construct ancestry
                //
                ? documentClient.get({
                        TableName: permanentTable,
                        Key: {
                            PermanentId: `NEIGHBORHOOD#${ParentId}`,
                            DataCategory: 'Details'
                        }
                    }).promise()
                    .then(({ Item = {} }) => (Item))
                    .then(({ Ancestry = '', ProgenitorId = '' }) => ({
                        PermanentId,
                        ParentId,
                        ...rest,
                        Ancestry: `${Ancestry}:${PermanentId}`,
                        ProgenitorId: ProgenitorId || PermanentId
                    }))
                //
                // No change from previous parent, so use previous ancestry
                //
                : Promise.resolve({
                    PermanentId,
                    ParentId,
                    ...rest,
                    Ancestry: rest.PreviousAncestry,
                    ProgenitorId: rest.PreviousProgenitorId
                })
            //
            // No parent means new ancestry and primogenitor are the permanent ID.
            //
            : Promise.resolve({
                PermanentId,
                ParentId,
                ...rest,
                Ancestry: PermanentId,
                ProgenitorId: PermanentId
            }))

    //
    // Create externalPut calls to update the AppSync API with what we're doing behind the scenes.
    //
    const updateToAppSyncCall = (Items) => (
        Items.length
            ? Promise.resolve(Items)
                .then((Items) => (Items.filter(({ DataCategory }) => (DataCategory === 'Details'))))
                .then((Items) => (Items.map(({
                    PermanentId,
                    Name,
                    Ancestry,
                    Description,
                    ParentId,
                    Visibility,
                    Topology,
                    ContextMapId
                }) => (`externalPut${PermanentId.startsWith("ROOM#") ? "Room" : "Neighborhood" } (
                        PermanentId: "${PermanentId.split("#").slice(1).join("#")}",
                        Name: ${JSON.stringify(Name)},
                        Ancestry: "${Ancestry}",
                        Description: ${JSON.stringify(Description)},
                        ParentId: "${ParentId}",
                        Visibility: "${ Visibility || 'Visible' }"
                        Topology: "${ Topology || 'Dead-End'}"
                        ${ PermanentId.startsWith('NEIGHBORHOOD#') ? `ContextMapId: "${ContextMapId}"` : ''}
                    ) {
                        Neighborhood {
                            PermanentId
                            Name
                            Ancestry
                            Description
                            ParentId
                            Visibility
                            Topology
                            ContextMapId
                            Grants {
                                CharacterId
                                Actions
                                Roles
                            }
                        }
                        Room {
                            PermanentId
                            Name
                            Ancestry
                            Description
                            ParentId
                            Visibility
                            Topology
                            Exits {
                                Name
                                RoomId
                                Ancestry
                            }
                            Entries {
                                Name
                                RoomId
                            }
                            Grants {
                                CharacterId
                                Actions
                                Roles
                            }
                        }
                        Map {
                            MapId
                            Name
                            Rooms {
                                PermanentId
                                X
                                Y
                            }
                        }
                    }
                    `))
                ))
                .then((Items) => (Items.reduce((previous, item, index) => (
                        `${previous}\nupdate${index+1}: ${item}`
                    ), '')
                ))
                .then((cascadeUpdate) => {
                    console.log(cascadeUpdate)
                    return cascadeUpdate
                })
                .then((aggregateString) => (gql`mutation CascadeUpdate {
                    ${aggregateString}
                }`))
                .then((cascadeUpdate) => (graphqlClient.mutate({ mutation: cascadeUpdate })))
            : []
    )

    const cascadeUpdates = ({
        Ancestry,
        ProgenitorId,
        PreviousAncestry,
        PreviousProgenitorId,
        ...rest
    }) => ((newNeighborhood || (Ancestry === PreviousAncestry))
        ? { Ancestry, ProgenitorId, ...rest }
        //
        // A parent change means we need to cascade-update all descendants, and then convey
        // that change to AppSync to service subscriptions on the data change.
        //
        : documentClient.query({
                TableName: permanentTable,
                KeyConditionExpression: 'ProgenitorId = :ProgenitorId AND begins_with(Ancestry, :RootAncestry)',
                ExpressionAttributeValues: {
                    ":ProgenitorId": PreviousProgenitorId,
                    ":RootAncestry": PreviousAncestry
                },
                IndexName: "AncestryIndex"
            }).promise()
            .then(({ Items }) => (Items || []))
            .then((Items) => (Items.filter(({ PermanentId }) => (PermanentId.split('#').slice(1).join('#') !== rest.PermanentId))))
            .then((Items) => (Items.map(({
                    Ancestry: FetchedAncestry,
                    ...rest
                }) => ({
                    ...rest,
                    Ancestry: `${Ancestry}:${FetchedAncestry.slice(PreviousAncestry.length+1)}`,
                    ProgenitorId
                }))
            ))
            //
            // Now send maximum-sized parallel batches to update all of these items directly
            // in DynamoDB
            //
            .then((Items) => {
                return Items.length
                    ? batchDispatcher(documentClient)(Items.map((Item) => ({
                            PutRequest: { Item }
                        }))).then(() => (Items))
                    : Items
            })
            .then(updateToAppSyncCall)
            .then(() => ({ Ancestry, ProgenitorId, ...rest }))
    )

    //
    // Create externalUpdate calls to update the AppSync API with what we're doing to grants (so people
    // can subscribe to the updates of their own grants, and get live permission changes)
    //
    const updateGrantsInAppSyncCall = (documentClient) => ({ grantsToDelete, grantsToPut }) => {
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
            .then((result) => {
                console.log(result)
                return result
            })
            .then((mutation) => (
                mutation.trim().length
                    ? graphqlClient.mutate({ mutation: gql`${mutation}`})
                    : {}
            ))
            .then(() => ({ grantsToDelete, grantsToPut }))
    }

    const updateGrants = ({
        CharacterId,
        PermanentId,
        Grants: sentGrants,
        ...rest
    }) => {
        const Grants = newNeighborhood
            ? [
                ...sentGrants.filter(({ CharacterId: grantCharacterId }) => (grantCharacterId !== CharacterId)),
                {
                    CharacterId,
                    Resource: PermanentId,
                    Roles: 'EDITOR'
                }
            ]
            : sentGrants
        return (newNeighborhood
            ? Promise.resolve([])
            : documentClient.query({
                TableName: permanentTable,
                KeyConditionExpression: 'DataCategory = :GrantId',
                ExpressionAttributeValues: {
                    ":GrantId": `GRANT#${PermanentId}`
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
                .filter(({ CharacterId }) => (!Grants.find((grant) => (CharacterId === grant.CharacterId))))
                .map((item) => ({ ...item, Resource: PermanentId })),
            grantsToPut: Grants.filter(({ CharacterId, Roles, Actions }) => (!OldGrants.find((oldGrant) => (
                    CharacterId === oldGrant.CharacterId &&
                    ((Actions === oldGrant.Actions) || (!Actions && !oldGrant.Actions)) &&
                    ((Roles === oldGrant.Roles) || (!Roles && !oldGrant.Roles))
                ))))
                .map((item) => ({ ...item, Resource: PermanentId }))
            }))
        .then(updateGrantsInAppSyncCall(documentClient))
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
        .then(batchDispatcher(documentClient))
        .then(() => ({ CharacterId, PermanentId, Grants, ...rest }))
    }

    const putNeighborhood = ({
        CharacterId,
        PermanentId,
        ParentId,
        Ancestry,
        ProgenitorId,
        Name,
        Description,
        Visibility = 'Private',
        Topology = 'Dead-End',
        ContextMapId,
        Grants = []
    }) => (documentClient.put({
            TableName: permanentTable,
            Item: {
                PermanentId: `NEIGHBORHOOD#${PermanentId}`,
                DataCategory: 'Details',
                ...(ParentId ? { ParentId } : {}),
                Ancestry,
                ProgenitorId,
                Name,
                ...(Description ? { Description } : {}),
                ...(Visibility ? { Visibility } : {}),
                ...(Topology ? { Topology } : {}),
                ...(ContextMapId ? { ContextMapId } : {})
            },
            ReturnValues: "ALL_OLD"
        }).promise()
            .then((old) => ((old && old.Attributes) || {}))
            .then(({ DataCategory, ...rest }) => ({
                ...rest,
                PermanentId,
                ParentId,
                Ancestry,
                ProgenitorId,
                Name,
                Description,
                Visibility,
                Topology,
                ContextMapId,
                Grants
            }))
    )

    return preCheckLookup
        .then(ancestryLookup)
        .then(cascadeUpdates)
        .then(updateGrants)
        .then(putNeighborhood)
        .then(({
            PermanentId,
            ParentId,
            Name,
            Description,
            Visibility,
            Topology,
            ContextMapId,
            Grants
        }) => ([{
            Neighborhood: {
                PermanentId,
                ParentId,
                Name,
                Description,
                Visibility,
                Topology,
                ContextMapId,
                Grants
            },
            Room: null,
            Map: null
        }]))
        .catch((err) => ({ error: err.stack }))

}
