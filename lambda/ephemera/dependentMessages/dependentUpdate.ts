import { AncestryUpdateMessage, DescentUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from "../internalCache"
import updateGraphStorage from "../mtw-utilities/dist/graphStorage/update"

export const dependentUpdateMessage = (dependencyTag: 'Descent' | 'Ancestry') => async ({ payloads, messageBus }: { payloads: (DescentUpdateMessage | AncestryUpdateMessage)[]; messageBus: MessageBus }): Promise<void> => (updateGraphStorage(internalCache, dependencyTag)({ payloads, messageBus }))

export default dependentUpdateMessage
