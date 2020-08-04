// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

exports.messageAndDeltas = (data) => {

    const { MessageId, Target = null, CreatedTime, DisplayProtocol, WorldMessage, CharacterMessage, DirectMessage, AnnounceMessage, RoomDescription } = data || {}

    const epochTime = CreatedTime || Date.now()

    let Message = undefined
    let CharacterId = undefined
    let Recipients = undefined
    let Title = undefined
    let RoomId = undefined
    let Name = undefined
    let Description = undefined
    let Exits = undefined
    let Characters = undefined

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
        case 'RoomDescription':
            RoomId = RoomDescription && RoomDescription.RoomId
            Name = RoomDescription && RoomDescription.Name
            Description = RoomDescription && RoomDescription.Description
            Exits = RoomDescription && RoomDescription.Exits
            Characters = RoomDescription && RoomDescription.Characters
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
                RoomId,
                Name,
                Description,
                Exits,
                Characters,
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
                Recipients,
                RoomId,
                Name,
                Description,
                Exits,
                Characters
            }]
            : []
    }

}
