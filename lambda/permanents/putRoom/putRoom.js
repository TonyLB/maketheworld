// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('../utilities')

const { permanentAndDeltas } = require('../delta')

exports.putRoom = (event) => {

    const { PermanentId, ParentId, Description, Name, Retired = false } = event.arguments

    return permanentAndDeltas({
            PutRequest: {
                Item: {
                    PermanentId: `ROOM#${PermanentId}`,
                    DataCategory: 'Details',
                    ...(ParentId ? { ParentId } : {}),
                    Name,
                    Description,
                    Visibility: 'Public',
                    ...(Retired ? { Retired: 'RETIRED' } : {}),
                }
            }
        })
        .then((writes) => (documentClient.batchWrite({ RequestItems: writes }).promise()))
        .then(() => ([{ Room: {
            PermanentId,
            ParentId,
            Name,
            Description,
            Visibility: 'Public',
            Retired
        }}]))
        .catch((err) => ({ error: err.stack }))

}
