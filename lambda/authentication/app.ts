// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import connect from './connect.js'
import { validateJWT } from './validateJWT.js'

export const handler = async (event: any) => {

    const { connectionId, routeKey } = event.requestContext || {}

    if (routeKey === '$connect') {
        const { Authorization = '' } = event.queryStringParameters || {}
        const { userName } = (await validateJWT(Authorization)) || {}
        if (userName) {
            return await connect(connectionId, userName)
        }
        else {
            return { statusCode: 403 }
        }
    }
    return { statusCode: 401 }

}