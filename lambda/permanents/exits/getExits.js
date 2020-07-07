// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { v4: uuidv4 } = require('/opt/uuid')
const { documentClient } = require('../utilities')

const { TABLE_PREFIX } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

exports.getExits = () => {

    return documentClient.scan({
        TableName: permanentTable,
        FilterExpression: 'begins_with(DataCategory, :Exit)',
        ExpressionAttributeValues: {
            ":Exit": `EXIT#`
        }
    }).promise()
    .then(({ Items }) => (Items.map(({ DataCategory, PermanentId, ...rest }) => {
        const FromRoomId = PermanentId.slice(5)
        const ToRoomId = DataCategory.slice(5)
        return {
            Exit: {
                FromRoomId,
                ToRoomId,
                ...rest
            }
        }
    })))

}
