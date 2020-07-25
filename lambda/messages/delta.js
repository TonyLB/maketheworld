// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

exports.messageAndDeltas = (data) => {

    const { MessageId, Message, Target = null, CreatedTime, DisplayProtocol, Title } = data || {}

    const epochTime = Date.now()

    return {
        messageWrites: [{
                MessageId: `MESSAGE#${MessageId}`,
                DataCategory: 'Content',
                Message,
                DisplayProtocol,
                Title,
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
                Title
            }]
            : []
    }

}
