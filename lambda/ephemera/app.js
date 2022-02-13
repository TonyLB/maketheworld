// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { unmarshall } from '@aws-sdk/util-dynamodb'

import { healGlobalValues, healCharacter } from '/opt/utilities/selfHealing/index.js'

import { processCharacterEvent } from './characterHandlers/index.js'
import { processPlayerEvent } from './playerHandlers/index.js'
import { splitType } from '/opt/utilities/types.js'
import { socketQueueFactory } from '/opt/utilities/apiManagement/index.js'
import { executeAction } from '/opt/utilities/perception/compileCode.js'

const postRecords = async (Records) => {
    const unmarshalledRecords = Records
        .map(({ eventName, dynamodb }) => ({
            eventName,
            data: {
                oldImage: unmarshall(dynamodb.OldImage || {}),
                newImage: unmarshall(dynamodb.NewImage || {})
            }
        }))
    const characterRecords = unmarshalledRecords
        .filter(({ data: { newImage } }) => ((newImage.EphemeraId ?? '').startsWith('CHARACTERINPLAY#') && newImage.DataCategory === 'Meta::Character'))
        .map(({ data: { newImage } }) => {
            const { EphemeraId, Name, RoomId, Connected, Color } = newImage
            return {
                type: 'CharacterInPlay',
                CharacterId: splitType(EphemeraId)[1],
                Name,
                Color,
                RoomId,
                Connected
            }
        })
    //
    // TODO: Figure out what Room information needs to be transmitted from Ephemera changes to the
    // client side of the fence (if any)
    //

    const updates = [
        ...characterRecords
    ]
    if (updates.length) {
        const socketQueue = socketQueueFactory()
        socketQueue.sendAll({
            messageType: 'Ephemera',
            updates
        })
        await socketQueue.flush()
    }

}

//
// dispatchRecords breaks incoming records into relevant categories, pre-processes
// the data-structure, and then dispatches them (either in groups or individually)
// to their handlers.  It returns a Promise.all of the individual async calls.
//
const dispatchRecords = (Records) => {
    //
    // Break out CharacterInPlay# records for processing
    //
    const characterRecords = Records
        .map(({ eventName, dynamodb }) => ({
            eventName,
            data: {
                oldImage: unmarshall(dynamodb.OldImage || {}),
                newImage: unmarshall(dynamodb.NewImage || {})
            }
        }))
        //
        // TODO: Once processing is localized, consider refactoring 'Connection' to 'Meta::Character'
        //
        .filter(({ data }) => (
            (data.oldImage.DataCategory === 'Meta::Character') ||
            (data.newImage.DataCategory === 'Meta::Character'))
        )
        .map(({ eventName, data }) => {
            const { DataCategory: oldDC, ...oldImage } = data.oldImage
            const { DataCategory: newDC, ...newImage } = data.newImage
            return { eventName, data: { oldImage, newImage } }
        })

    const playerRecords = Records
        .map(({ eventName, dynamodb }) => ({
            eventName,
            data: {
                oldImage: unmarshall(dynamodb.OldImage || {}),
                newImage: unmarshall(dynamodb.NewImage || {})
            }
        }))
        .filter(({ data }) => (
            ((data.oldImage.EphemeraId || '').startsWith('PLAYER#')) ||
            ((data.newImage.EphemeraId || '').startsWith('PLAYER#')))
        )
        .map(({ eventName, data }) => {
            return { eventName, data: { oldImage: data.oldImage, newImage: data.newImage } }
        })
    //
    // TODO: Create function to parse through the entirety of the set of records, and
    // figure out what records need to be forwarded as Ephemera updates to whom.
    //
    return Promise.all([
        ...characterRecords.map(processCharacterEvent),
        ...playerRecords.map(processPlayerEvent),
        postRecords(Records)
    ])
}

export const handler = async (event, context) => {

    const { action = 'NO-OP', directCall = false, Records, ...payload } = event

    if (Records && Records.length) {
        await dispatchRecords(Records)
    }
    else {
        switch(action) {
            
            case 'healGlobal':
                await healGlobalValues()
                break;

            case 'heal':
                await healCharacter(event.CharacterId)
                break;

            case 'evaluate':
                await executeAction(event.ActionId)
                break;

            default:
                context.fail(JSON.stringify(`Error: Unknown action: ${action}`))
        }
    }
}