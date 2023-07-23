import { AncestryUpdateMessage, DescentUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import { updateGraphStorage } from "../mtw-utilities/dist/graphStorage/update"
import { graphCache, graphStorageDB } from "./graphCache"

export const dependentUpdateMessage = (dependencyTag: 'Descent' | 'Ancestry') => async ({ payloads }: { payloads: (DescentUpdateMessage | AncestryUpdateMessage)[] }): Promise<void> => {
    const sortedPayload = {
        descent: payloads.filter(({ type }) => (type === 'DescentUpdate')),
        ancestry: payloads.filter(({ type }) => (type === 'AncestryUpdate'))
    }
    await Promise.all([
        updateGraphStorage({ internalCache: graphCache, dbHandler: graphStorageDB })(sortedPayload)
    ])
}

export default dependentUpdateMessage
