// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

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

exports.putMessage = (event) => {

    const { MessageId, CreatedTime, Characters = [], DisplayProtocol, RoomId } = event
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
            CharacterMessage = eventMapping(['Message', 'CharacterId', 'Title'])
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

    const targets = [...(RoomId ? [`ROOM#${RoomId}`] : []), ...Characters.map((characterId) => (`CHARACTER#${characterId}`))]

    const { messageWrites, deltaWrites } = targets.map((Target) => (messageAndDeltas({
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
        messageWrites: Object.values(messageWrites).sort(({ index: indexA }, { index: indexB }) => (indexA - indexB)).map(({ index, ...item }) => ({ PutRequest: { Item: item }})),
        deltaWrites: Object.values(deltaWrites).sort(({ index: indexA }, { index: indexB }) => (indexA - indexB)).map(({ index, ...item }) => ({ PutRequest: { Item: item }}))
    })
}
