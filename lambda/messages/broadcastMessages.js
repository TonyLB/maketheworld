// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

//
// broadcastMessage takes a message and a list of targets, and creates a list of non-data-source
// appSync calls, in order to trigger subscriptions.  When this function is called, and the
// appSync calls delivered, any subscription that has been created (on, for instance, a
// CharacterId filter) will receive the information in the arguments.
//

const { gqlOutput } = require('./gqlOutput')

const argumentList = ({ data = {}, dataKey = 'Test', keys = [] }) => (
    `${dataKey}: { ${keys.map((key) => ((data[key] && `${key}: ${JSON.stringify(data[key])}`) || '')).filter((item) => (item)).join(', ')} }`
)

const broadcastMessageGQL = ({ MessageId, Target, CreatedTime, DisplayProtocol, WorldMessage, CharacterMessage, DirectMessage, AnnounceMessage }) => (
    `broadcastMessage(Message: {
        MessageId: "${MessageId}"
        Target: "${Target}"
        CreatedTime: ${CreatedTime}
        DisplayProtocol: "${DisplayProtocol}"
        ${[
            WorldMessage ? argumentList({ data: WorldMessage, dataKey: 'WorldMessage', keys: ['Message'] }) : '',
            CharacterMessage ? `CharacterMessage: { CharacterId: ${JSON.stringify(CharacterMessage.CharacterId)}, Message: ${JSON.stringify(CharacterMessage.Message)} }` : '',
            DirectMessage ? argumentList({ data: DirectMessage, dataKey: 'DirectMessage', keys: ['CharacterId', 'Message', 'Title', 'Recipients']}) : '',
            AnnounceMessage ? argumentList({ data: AnnounceMessage, dataKey: 'AnnounceMessage', keys: ['CharacterId', 'Message', 'Title']}): ''
        ].filter((item) => (item)).join('\n    ')}
    }) { ${gqlOutput} }`)

exports.broadcastMessages = ({ Characters, ...rest }) => (
    Characters.map((Target) => (broadcastMessageGQL({ Target, ...rest })))
)