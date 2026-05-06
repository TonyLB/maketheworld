// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { routeConnectionsIngress } from "./dataSource/index"

export const handler = async (event: any) => {
    return await routeConnectionsIngress(event)
}