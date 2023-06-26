import { AncestryUpdateMessage, DescentUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from "../internalCache"
import updateGraphStorage from "../mtw-utilities/dist/graphStorage/update"

export const dependentUpdateMessage = (dependencyTag: 'Descent' | 'Ancestry') => async ({ payloads }: { payloads: (DescentUpdateMessage | AncestryUpdateMessage)[] }): Promise<void> => (updateGraphStorage(internalCache)({
    descent: payloads.filter(({ type }) => (type === 'DescentUpdate')),
    ancestry: payloads.filter(({ type }) => (type === 'AncestryUpdate'))
}))

export default dependentUpdateMessage
