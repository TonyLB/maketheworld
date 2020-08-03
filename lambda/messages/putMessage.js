// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { messageAndDeltas } = require('./delta')
const { broadcastMessages } = require('./broadcastMessages')

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
    const epochTime = Date.now()

    const { MessageId, RoomId = null, Characters = [], DisplayProtocol, WorldMessage, CharacterMessage, DirectMessage, AnnounceMessage } = event

    const targets = [...(RoomId ? [`ROOM#${RoomId}`] : []), ...Characters.map((characterId) => (`CHARACTER#${characterId}`))]

    const { messageWrites, deltaWrites } = targets.map((Target) => (messageAndDeltas({
            MessageId,
            Target,
            DisplayProtocol,
            WorldMessage,
            CharacterMessage,
            DirectMessage,
            AnnounceMessage
        })))
        .reduce(messageAndDeltaReducer, { messageWrites: {}, deltaWrites: {} })
    const gqlWrites = broadcastMessages({
        MessageId,
        Characters,
        DisplayProtocol,
        CreatedTime: epochTime,
        WorldMessage,
        CharacterMessage,
        DirectMessage,
        AnnounceMessage
    })

    return Promise.resolve({
        messageWrites: Object.values(messageWrites).sort(({ index: indexA }, { index: indexB }) => (indexA - indexB)).map(({ index, ...item }) => ({ PutRequest: { Item: item }})),
        deltaWrites: Object.values(deltaWrites).sort(({ index: indexA }, { index: indexB }) => (indexA - indexB)).map(({ index, ...item }) => ({ PutRequest: { Item: item }})),
        gqlWrites
    })
}
