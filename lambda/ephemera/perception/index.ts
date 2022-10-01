import { PerceptionMessage, MessageBus } from "../messageBus/baseClasses"
import { render } from "@tonylb/mtw-utilities/dist/perception"
import { deliverRenders } from "@tonylb/mtw-utilities/dist/perception/deliverRenders"
import { tagFromEphemeraId } from "../internalCache/dependencyGraph"

export const perceptionMessage = async ({ payloads, messageBus }: { payloads: PerceptionMessage[], messageBus: MessageBus }): Promise<void> => {
    const renderOutputs = await render({
        renderList: payloads
            // .filter(({ ephemeraId }) => (!(['Room', 'Feature'].includes(tagFromEphemeraId(ephemeraId)))))
            .map(({ characterId, ephemeraId }) => ({
                CharacterId: characterId,
                EphemeraId: ephemeraId
            }))
    })
    //
    // TODO: Replace deliverRenders with a messageBus handler
    //
    await deliverRenders({
        renderOutputs
    })

    //
    // TODO: Translate other types, above, into directly-handled format like below
    //
    await Promise.all(payloads.filter(({ ephemeraId }) => (['Room', 'Feature'].includes(tagFromEphemeraId(ephemeraId))))
        .map(async ({ characterId, ephemeraId }) => {

        })
    )

    messageBus.send({
        type: 'ReturnValue',
        body: {
            messageType: "ActionComplete"
        }
    })
}

export default perceptionMessage
