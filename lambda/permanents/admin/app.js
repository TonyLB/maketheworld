// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('./utilities')
const { v4: uuidv4 } = require('/opt/uuid')

const { initiateBackup } = require('./initiateBackup')
const { restoreBackup } = require('./restoreBackup')
const { uploadBackup } = require('./uploadBackup')
const { getSettings, putSettings } = require('./adminSettings')
const { TABLE_PREFIX, AWS_REGION } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

const getBackups = async () => {
    const { Items = [] } = await documentClient.query({
            TableName: permanentTable,
            KeyConditionExpression: 'PermanentId = :Admin and begins_with(DataCategory, :Backup)',
            ExpressionAttributeValues: {
                ":Admin": "ADMIN",
                ":Backup": "BACKUP#"
            }
        }).promise()

    return Items
        .map(({ DataCategory = '', Name, Description, Status }) => ({
            PermanentId: DataCategory.split('#').slice(1).join('#'),
            Name,
            Description,
            Status
        }))
}

const getBackup = async ({ PermanentId }) => {
    const { Item = {} } = await documentClient.get({
            TableName: permanentTable,
            Key: {
                PermanentId: 'ADMIN',
                DataCategory: `BACKUP#${PermanentId}`
            }
        }).promise()

    const { DataCategory = '', Name, Description, Status } = Item
    return {
        PermanentId: DataCategory.split('#').slice(1).join('#'),
        Name,
        Description,
        Status
    }
}

const putBackup = async ({ PermanentId, Name, Description, Status }) => {
    const oldBackup = PermanentId ? await getBackup({ PermanentId }) : {}
    const newBackup = {
        ...oldBackup,
        PermanentId: PermanentId || uuidv4(),
        ...(Name !== undefined ? { Name } : {}),
        ...(Description !== undefined ? { Description } : {}),
        ...(Status !== undefined ? { Status } : {}),
    }

    await documentClient.put({
        TableName: permanentTable,
        Item: {
            ...newBackup,
            PermanentId: `ADMIN`,
            DataCategory: `BACKUP#${newBackup.PermanentId}`
        }
    }).promise()
    return [{ Backup: newBackup }]
}

const createBackup = ({ PermanentId, Name, Description }) => {
    const newPermanentId = PermanentId || uuidv4()
    return initiateBackup({ PermanentId: newPermanentId, Name, Description })
        .then(() => (putBackup({ PermanentId: newPermanentId, Status: 'Completed.' })))
}

exports.handler = (event, context) => {
    const { action, ...payload } = event

    switch(action) {
        case "getBackups":
            return getBackups()
        case "putBackup":
            return putBackup(payload)
        case "createBackup":
            return createBackup(payload)
        case "restoreBackup":
            return restoreBackup(payload)
        case "uploadBackup":
            return uploadBackup(payload, context)
                .then(({ PermanentId }) => {
                    if (!PermanentId) {
                        return {}
                    }
                    return putBackup({ PermanentId, Status: 'Uploaded.'})
                })
                .then(() => ({
                    statusCode: 200,
                    body: JSON.stringify({
                        message: "Upload completed."
                    })
                }))
        case "getSettings":
            return getSettings()
        case "putSettings":
            return putSettings(payload)
        default:
            context.fail(JSON.stringify(`Error: Unknown action: ${action}`))
    }
}