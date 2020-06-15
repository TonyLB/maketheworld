// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('/opt/uuid')
const { documentClient, graphqlClient, gql } = require('utilities')
const { gqlOutput } = require('gqlOutput')

const batchGetDispatcher = (documentClient, ProjectionExpression = 'PermanentId, DataCategory, Ancestry, ProgenitorId') => (items) => {
    const permanentTable = `${process.env.TABLE_PREFIX}_permanents`
    const groupBatches = items.reduce((({ current, requestLists }, item) => {
            if (current.length > 50) {
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
        .map((itemList) => (documentClient.batchGet({ RequestItems: {
            [permanentTable]: {
                Keys: itemList,
                ProjectionExpression: 'PermanentId, #Name, Pronouns, FirstImpression, OneCoolThing, Outfit, HomeId',
                ExpressionAttributeNames: {
                    "#Name": "Name"
                }
            }
        } }).promise()))
    return Promise.all(batchPromises)
        .then((returnVals) => (returnVals.reduce((previous, { Responses }) => ([ ...previous, ...((Responses && Responses[permanentTable]) || []) ]), [])))
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
        .map((itemList) => (documentClient.batchWrite({ RequestItems: {
            [`${process.env.TABLE_PREFIX}_permanents`]: itemList
        } }).promise()))
    return Promise.all(batchPromises)
}

const getCharacterInfo = ({ CharacterId }) => (
    documentClient.query({
        TableName: `${process.env.TABLE_PREFIX}_permanents`,
        KeyConditionExpression: 'PermanentId = :CharacterId',
        ExpressionAttributeValues: {
            ":CharacterId": `CHARACTER#${CharacterId}`
        }
    }).promise()
    .then(({ Items }) => (Items.reduce((previous, { DataCategory, PermanentId, ...rest }) => {
        if (DataCategory === 'Details') {
            return {
                ...previous,
                CharacterId: PermanentId.slice(10),
                Grants: rest.Grants || [],
                ...rest
            }
        }
        if (DataCategory.startsWith('GRANT#')) {
            const Resource = DataCategory.slice(6)
            const Actions = rest.Actions
            const Roles = rest.Roles
            return (Actions || Roles)
                ? {
                    ...previous,
                    Grants: [
                        ...(previous.Grants || []),
                        {
                            Resource,
                            Actions,
                            Roles
                        }
                    ]
                }
                : previous
        }
    }, {})))
)
exports.getCharacter = (event) => {

    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const { CharacterId } = event

    return CharacterId
        ? (getCharacterInfo({ CharacterId }))
            .then(({ Name, Pronouns, FirstImpression, OneCoolThing, Outfit, HomeId, Grants }) => ({
                CharacterId, Name, Pronouns, FirstImpression, OneCoolThing, Outfit, HomeId, Grants
            }))
            .then(({ CharacterId, ...rest }) => (documentClient.query({
                    TableName: permanentTable,
                    KeyConditionExpression: 'DataCategory = :CharacterId',
                    ExpressionAttributeValues: {
                        ":CharacterId": `CHARACTER#${CharacterId}`
                    },
                    IndexName: "DataCategoryIndex",
                    Limit: 1
                }).promise()
                .then(({ Items }) => (Items))
                .then((Items) => (Items[0]))
                .then(({ PermanentId }) => (PermanentId.split('#').slice(1).join('#')))
                .then((PlayerName) => ({ PlayerName, CharacterId, ...rest }))
            ))
            .catch((err) => ({ error: err.stack }))
        : Promise.resolve({ error: "No CharacterId specified"})

}

exports.getPlayerCharacters = (event) => {

    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const { PlayerName } = event

    return PlayerName
        ? (documentClient.query({
                TableName: permanentTable,
                KeyConditionExpression: 'PermanentId = :PlayerId AND begins_with(DataCategory, :CharacterId)',
                ExpressionAttributeValues: {
                    ":PlayerId": `PLAYER#${PlayerName}`,
                    ":CharacterId": `CHARACTER#`
                },
            }).promise())
            .then(({ Items }) => Items.map(({ DataCategory }) => (DataCategory.slice(10))))
            .then((result) => {
                console.log(JSON.stringify(result, null, 4))
                return result
            })
            .then((Items) => (Promise.all(Items.map((CharacterId) => (getCharacterInfo({ documentClient, CharacterId }))))))
            .then((result) => {
                console.log(JSON.stringify(result, null, 4))
                return result
            })
            .then((Items) => (Items.map((Item) => ({
                PlayerName,
                ...Item
            }))))
            .then((Items) => (Items.map((Item) => ({ ...Item }))))
            .catch((err) => ({ error: err.stack }))
        : Promise.resolve({ error: "No PlayerName specified"})

}

exports.getAllCharacters = () => {

    return documentClient.scan({
        TableName: `${process.env.TABLE_PREFIX}_permanents`,
        FilterExpression: 'begins_with(#PermanentId, :Character)',
        ExpressionAttributeValues: {
            ":Character": `CHARACTER#`
        },
        ExpressionAttributeNames: {
            '#PermanentId': 'PermanentId'
        }
    }).promise()
        .then(({ Items }) => (Items.reduce((previous, { DataCategory, PermanentId, ...rest }) => {
            const CharacterId = PermanentId.slice(10)
            if (DataCategory === 'Details') {
                return {
                    ...previous,
                    [CharacterId]: {
                        ...(previous[CharacterId] || {}),
                        CharacterId,
                        Grants: (previous[CharacterId] && previous[CharacterId].Grants) || [],
                        ...rest
                    }
                }
            }
            if (DataCategory.startsWith('GRANT#')) {
                const Resource = DataCategory.slice(6)
                const Actions = rest.Actions
                const Roles = rest.Roles
                return (Actions || Roles)
                    ? {
                        ...previous,
                        [CharacterId]: {
                            ...(previous[CharacterId] || {}),
                            CharacterId,
                            Grants: [
                                ...((previous[CharacterId] && previous[CharacterId].Grants) || []),
                                {
                                    Resource,
                                    Actions,
                                    Roles
                                }
                            ]
                        }
                    }
                    : previous
            }
            return previous
        }, {})))
        .then((Characters) => (Object.values(Characters)))
}

const characterGQL = ({
        Name,
        CharacterId,
        Pronouns,
        FirstImpression,
        Outfit,
        OneCoolThing,
        HomeId
    }) => (gql`mutation ReportCharacter {
    externalPutCharacter (Name: "${Name}", CharacterId: "${CharacterId}", Pronouns: "${Pronouns}", FirstImpression: "${FirstImpression}", Outfit: "${Outfit}", OneCoolThing: "${OneCoolThing}", HomeId: "${HomeId}") {
        ${gqlOutput}
    }
}`)

const characterGQLReport = async ({
    Name,
    CharacterId,
    Pronouns,
    FirstImpression,
    Outfit,
    OneCoolThing,
    HomeId
}) => {
    if (CharacterId) {
        await graphqlClient.mutate({ mutation: characterGQL({
            Name,
            CharacterId,
            Pronouns,
            FirstImpression,
            Outfit,
            OneCoolThing,
            HomeId
        }) })
    }
}

exports.putCharacter = ({
    CharacterId: passedCharacterId,
    PlayerName,
    Name,
    Pronouns,
    FirstImpression,
    OneCoolThing,
    Outfit,
    HomeId
}) => {

    const newCharacter = !Boolean(passedCharacterId)
    const CharacterId = passedCharacterId || uuidv4()

    return batchDispatcher(documentClient)([{
            PutRequest: {
                Item: {
                    PermanentId: `CHARACTER#${CharacterId}`,
                    DataCategory: 'Details',
                    Name,
                    Pronouns,
                    FirstImpression,
                    OneCoolThing,
                    Outfit,
                    HomeId
                }
            }
        },
        {
            PutRequest: {
                Item: {
                    PermanentId: `PLAYER#${PlayerName}`,
                    DataCategory: `CHARACTER#${CharacterId}`
                }
            }
        },
        ...((newCharacter && [{
            PutRequest: {
                Item: {
                    PermanentId: `CHARACTER#${CharacterId}`,
                    DataCategory: 'GRANT#MINIMUM',
                    Roles: 'PLAYER'
                }
            }
        }]) || [])
        ])
        .then(characterGQLReport({
            Name,
            CharacterId,
            Pronouns,
            FirstImpression,
            Outfit,
            OneCoolThing,
            HomeId
        }))
        .then(() => (getCharacterInfo({ documentClient, CharacterId })))
        .then(({ Grants }) => ({
            Type: "CHARACTER",
            PlayerName,
            CharacterInfo: {
                CharacterId,
                PlayerName,
                Name,
                Pronouns,
                FirstImpression,
                OneCoolThing,
                Outfit,
                HomeId,
                Grants
            }
        }))
        .catch((err) => ({ error: err.stack }))

}