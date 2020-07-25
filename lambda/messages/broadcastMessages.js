// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

//
// broadcastMessage takes a message and a list of targets, and creates a list of non-data-source
// appSync calls, in order to trigger subscriptions.  When this function is called, and the
// appSync calls delivered, any subscription that has been created (on, for instance, a
// CharacterId filter) will receive the information in the arguments.
//

const { gqlOutput } = require('./gqlOutput')

const broadcastMessageGQL = ({ MessageId, Message, Target, CreatedTime, CharacterId, DisplayProtocol, Title, Recipients }) => (
    `broadcastMessage(Message: {
        MessageId: "${MessageId}",
        Message: ${JSON.stringify(Message)},
        Target: "${Target}",
        ${ CharacterId ? `CharacterId: "${CharacterId}",` : "" }
        ${ DisplayProtocol ? `DisplayProtocol: "${DisplayProtocol}",` : "" }
        ${ Title ? `Title: "${Title}",` : "" }
        ${ Recipients ? `Recipients: ${JSON.stringify(Recipients)},` : "" }
        CreatedTime: ${CreatedTime}
    }) { ${gqlOutput} }`)

exports.broadcastMessages = ({ Characters, ...rest }) => (
    Characters.map((Target) => (broadcastMessageGQL({ Target, ...rest })))
)