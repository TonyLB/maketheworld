// Copyright 2023 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export const handler = async (event: any) => {

    const { connectionId } = event.requestContext || {}

    console.log(`deliverMessageSync called on connectionId: ${connectionId}`)
    console.log(`event: ${JSON.stringify(event, null, 4)}`)

    return { statusCode: 200 }

}