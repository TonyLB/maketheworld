// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

exports.messageAndDeltas = (data) => {

    const { MessageId, Target = null, CreatedTime, DisplayProtocol, WorldMessage, CharacterMessage, DirectMessage, AnnounceMessage } = data || {}

    const epochTime = CreatedTime || Date.now()

    let Message = undefined
    let CharacterId = undefined
    let Recipients = undefined
    let Title = undefined

    switch(DisplayProtocol) {
        case 'World':
            Message = WorldMessage && WorldMessage.Message
            break
        case 'Player':
            Message = CharacterMessage && CharacterMessage.Message
            CharacterId = CharacterMessage && CharacterMessage.CharacterId
            break
        case 'Direct':
            Message = DirectMessage && DirectMessage.Message
            CharacterId = DirectMessage && DirectMessage.CharacterId
            Title = DirectMessage && DirectMessage.Title
            Recipients = DirectMessage && DirectMessage.Recipients
            break
        case 'Announce':
            Message = AnnounceMessage && AnnounceMessage.Message
            CharacterId = AnnounceMessage && AnnounceMessage.CharacterId
            Title = AnnounceMessage && AnnounceMessage.Title
            break
        default:
            break
    }

    return {
        messageWrites: [{
                MessageId: `MESSAGE#${MessageId}`,
                DataCategory: 'Content',
                Message,
                DisplayProtocol,
                Title,
                CharacterId,
                Recipients,
                CreatedTime: epochTime
            },
            ...(Target
                ? [{
                    MessageId: Target,
                    DataCategory: `MESSAGE#${MessageId}`,
                    CreatedTime: epochTime
                }]
                : []
            )
        ],
        deltaWrites: Target && !Target.startsWith('ROOM#')
            ? [{
                Target: Target,
                DeltaId: `${epochTime}::MESSAGE#${MessageId}::Content`,
                RowId: `MESSAGE#${MessageId}::Content`,
                Message,
                DisplayProtocol,
                Title,
                CharacterId,
                Recipients
            }]
            : []
    }

}
