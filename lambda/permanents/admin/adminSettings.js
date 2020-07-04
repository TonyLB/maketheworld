// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('./utilities')
const { TABLE_PREFIX, AWS_REGION } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

const getSettings = () => {
    return documentClient.get({
        TableName: permanentTable,
        Key: {
            PermanentId: `ADMIN`,
            DataCategory: 'Details'
        }
    }).promise()
    .then(({ Item = {} }) => (Item))
    .then(({ ChatPrompt = 'What do you do?' }) => ({ ChatPrompt }))
}

const putSettings = (payload) => {
    const { ChatPrompt } = payload

    if (ChatPrompt) {
        return documentClient.put({
                TableName: permanentTable,
                Item: {
                    PermanentId: 'ADMIN',
                    DataCategory: 'Details',
                    ChatPrompt
                }
            }).promise()
            .then(() => ([{ Settings: payload }]))
    }
    else {
        return Promise.resolve([])
    }


}

exports.getSettings = getSettings
exports.putSettings = putSettings
