import { AncestryUpdateMessage, DescentUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from "../internalCache"
import legacyUpdateGraphStorage, { updateGraphStorage } from "../mtw-utilities/dist/graphStorage/update"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { graphCache, graphStorageDB } from "./graphCache"

export const dependentUpdateMessage = (dependencyTag: 'Descent' | 'Ancestry') => async ({ payloads }: { payloads: (DescentUpdateMessage | AncestryUpdateMessage)[] }): Promise<void> => {
    const sortedPayload = {
        descent: payloads.filter(({ type }) => (type === 'DescentUpdate')),
        ancestry: payloads.filter(({ type }) => (type === 'AncestryUpdate'))
    }
    await Promise.all([
        legacyUpdateGraphStorage({ internalCache, dbHandler: ephemeraDB as any, keyLabel: 'EphemeraId' })(sortedPayload),
        updateGraphStorage({ internalCache: graphCache, dbHandler: graphStorageDB })(sortedPayload)
    ])
}

export default dependentUpdateMessage
