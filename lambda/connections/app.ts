// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { routeConnectionsIngress } from "./ingress"
import messageBus from "./messageBus"
import { extractReturnValue } from "./returnValue"

export const handler = async (event: any) => {
    messageBus.clear()
    await routeConnectionsIngress(event)
    await messageBus.flush()
    return extractReturnValue(messageBus, event)
}