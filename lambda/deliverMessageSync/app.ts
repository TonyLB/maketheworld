// Copyright 2023 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { apiClient } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"
import { unmarshall } from "@aws-sdk/util-dynamodb"

export const handler = async (event: any) => {

    const { ConnectionId, RequestId, Target: TargetId, Items } = event

    //
    // TODO: Adapt translation function from syncHandler to apply to Items and generate
    // messages
    //
    const messages = Items
        .map(unmarshall)
        .map(({ Target, DeltaId, RowId, ...rest }) => ({ Target: TargetId, MessageId: RowId, ...rest }))

    if (RequestId) {
        await apiClient.send({
            ConnectionId,
            Data: JSON.stringify({
                messageType: 'Messages',
                messages,
                LastSync: Date.now(),
                RequestId
            })
        })
    }
    else {
        await apiClient.send({
            ConnectionId,
            Data: JSON.stringify({
                messageType: 'Messages',
                messages
            })
        })    
    }

    return { statusCode: 200 }

}