// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { v4: uuidv4 } = require('/opt/uuid')

const { documentClient } = require('../utilities')

const batchDispatcher = (items) => {
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

exports.putRoom = (event) => {

    const { TABLE_PREFIX } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const { PermanentId, ParentId, Description, Name, Retired = false, Entries = [], Exits = [] } = event.arguments

    const newRoom = !Boolean(PermanentId)

    const putRoom = ({
        PermanentId,
        ParentId,
        Name,
        Description,
        Visibility = 'Public',
        Retired = false
    }) => (Promise.resolve([
            {
                PutRequest: {
                    Item: {
                        PermanentId: `ROOM#${PermanentId}`,
                        DataCategory: 'Details',
                        ...(ParentId ? { ParentId } : {}),
                        Name,
                        Description,
                        ...(Retired ? { Retired: 'RETIRED' } : {}),
                        ...(Visibility ? { Visibility } : {})
                    }
                }
            }
        ])
        .then(batchDispatcher)
        .then(() => ([ { Room: {
            PermanentId,
            ParentId,
            Name,
            Description,
            Visibility,
            Topology: '',
            Grants: [],
            Retired,
        }} ]))
    )

    return putRoom({
        PermanentId,
        ParentId,
        Name,
        Description,
        Visibility: 'Public',
        Retired
    })
        .catch((err) => ({ error: err.stack }))

}
