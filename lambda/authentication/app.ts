// Copyright 2023 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import connect from './connect.js'
import { validateJWT } from './validateJWT.js'

export const handler = async (event: any) => {

    const { connectionId, routeKey } = event.requestContext || {}

    if (routeKey === '$connect') {
        const { Authorization = '', SessionId = '' } = event.queryStringParameters || {}
        const { userName } = (await validateJWT(Authorization)) || {}
        if (userName) {
            return await connect(connectionId, userName, SessionId)
        }
        else {
            return { statusCode: 403 }
        }
    }
    return { statusCode: 401 }

}