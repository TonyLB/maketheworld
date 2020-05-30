// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('utilities')
const { v4: uuidv4 } = require('/opt/uuid')

const { initiateBackup } = require('initiateBackup')
const { uploadBackup } = require('uploadBackup')
const { TABLE_PREFIX, AWS_REGION } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

const getSettings = () => {
    return documentClient.get({
        TableName: `${TABLE_PREFIX}_permanents`,
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

//
// TODO:  (1) Create handlers for storing backup meta-data in the permanents database
// under the Admin heading.
//
//   (2) Create a REST API that can accept uploads and serve downloads from the
// StorageBucket S3 area, in order to give people client-based ability to download
// and upload backup files.
//
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
        case "uploadBackup":
            return uploadBackup(payload, context)
                .then(({ PermanentId }) => putBackup({ PermanentId, Status: 'Uploaded.'}))
        case "getSettings":
            return getSettings()
        case "putSettings":
            return putSettings(payload)
        default:
            context.fail(JSON.stringify(`Unknown action: ${action}`))
    }
}