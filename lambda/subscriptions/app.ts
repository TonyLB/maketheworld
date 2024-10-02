// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export const handler = async (event: any) => {

    console.log(`event: ${JSON.stringify(event, null, 4)}`)
    return {
        statusCode: 200,
        body: "{}"
    }

}