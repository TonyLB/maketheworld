import { PerceptionMessage, MessageBus } from "../messageBus/baseClasses"
import { render } from "@tonylb/mtw-utilities/dist/perception"
import { deliverRenders } from "@tonylb/mtw-utilities/dist/perception/deliverRenders"

export const perceptionMessage = async ({ payloads, messageBus }: { payloads: PerceptionMessage[], messageBus: MessageBus }): Promise<void> => {
    const renderOutputs = await render({
        renderList: payloads.map(({ characterId, ephemeraId }) => ({
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
    
    messageBus.send({
        type: 'ReturnValue',
        body: {
            messageType: "ActionComplete"
        }
    })
}

export default perceptionMessage
