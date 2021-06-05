// Copyright 2021 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { marshall } = require('@aws-sdk/util-dynamodb')

const { messageAndDeltas } = require('./delta')

const messageAndDeltaReducer = ({
        messageWrites: previousMessageWrites = {},
        deltaWrites: previousDeltaWrites = {}
    },
    {
        messageWrites,
        deltaWrites
    }) => ({
        messageWrites: messageWrites.reduce((previous, { MessageId, DataCategory, ...rest }, index) => ({ ...previous, [`${MessageId}::${DataCategory}`]: { MessageId, DataCategory, index: (previous[`${MessageId}::${DataCategory}`] || {}).index || index, ...rest }}), previousMessageWrites),
        deltaWrites: deltaWrites.reduce((previous, { RowId, Target, ...rest }) => ({ ...previous, [`${Target}::${RowId}`]: { Target, RowId, ...rest }}), previousDeltaWrites)
    })

//
// TODO:  Revamp storage schematic now that we can make use of GraphQL unions
//
exports.putMessage = (event) => {

    const { MessageId, CreatedTime, Targets = [], DisplayProtocol } = event
    let WorldMessage, CharacterMessage, DirectMessage, AnnounceMessage, RoomDescription

    const eventMapping = (props) => (props.reduce((previous, key) => ({ ...previous, [key]: event[key] }), {}))

    switch(DisplayProtocol) {
        case 'World':
            WorldMessage = eventMapping(['Message'])
            break
        case 'Player':
            CharacterMessage = eventMapping(['Message', 'CharacterId'])
            break
        case 'Direct':
            DirectMessage = eventMapping(['Message', 'CharacterId', 'Title', 'Recipients'])
            break
        case 'Announce':
            AnnounceMessage = eventMapping(['Message', 'CharacterId', 'Title'])
            break
        case 'RoomDescription':
            RoomDescription = {
                ...eventMapping(['RoomId', 'Name', 'Description', 'Exits']),
                Characters: event.RoomCharacters
            }
            break
        default:
            break
    }

    const { messageWrites, deltaWrites } = Targets.map((Target) => (messageAndDeltas({
            MessageId,
            CreatedTime,
            Target,
            DisplayProtocol,
            WorldMessage,
            CharacterMessage,
            DirectMessage,
            AnnounceMessage,
            RoomDescription
        })))
        .reduce(messageAndDeltaReducer, { messageWrites: {}, deltaWrites: {} })
    return Promise.resolve({
        messageWrites: Object.values(messageWrites).sort(({ index: indexA }, { index: indexB }) => (indexA - indexB)).map(({ index, ...item }) => ({ PutRequest: { Item: marshall(item, { removeUndefinedValues: true }) }})),
        deltaWrites: Object.values(deltaWrites).sort(({ index: indexA }, { index: indexB }) => (indexA - indexB)).map(({ index, ...item }) => ({ PutRequest: { Item: marshall(item, { removeUndefinedValues: true }) }}))
    })
}
