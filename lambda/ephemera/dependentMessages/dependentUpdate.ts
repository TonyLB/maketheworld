import { AncestryUpdateMessage, DescentUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from "../internalCache"
import updateGraphStorage from "../mtw-utilities/dist/graphStorage/update"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

//
// TODO: Refactor dependentUpdateMessage and graphStorage to use new DBHandler formats
//
export const dependentUpdateMessage = (dependencyTag: 'Descent' | 'Ancestry') => async ({ payloads }: { payloads: (DescentUpdateMessage | AncestryUpdateMessage)[] }): Promise<void> => (updateGraphStorage({ internalCache, dbHandler: ephemeraDB as any, keyLabel: 'EphemeraId' })({
    descent: payloads.filter(({ type }) => (type === 'DescentUpdate')),
    ancestry: payloads.filter(({ type }) => (type === 'AncestryUpdate'))
}))

export default dependentUpdateMessage
