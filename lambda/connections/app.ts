// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { routeConnectionsIngress } from "./dataSource/index"
import messageBus from "./messageBus"

export const handler = async (event: any) => {
    messageBus.clear()
    return await routeConnectionsIngress(event)
}