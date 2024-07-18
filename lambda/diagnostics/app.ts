import { healPlayer } from "./player"

export const handler = async (event) => {

    //
    // Handle EventBridge messages
    //
    if (event?.source === 'mtw.diagnostics' && event["detail-type"] === 'Heal Player' && event.detail?.player) {
        return await healPlayer(event.detail?.player)
    }

    //
    // Handle direct calls (e.g. step functions)
    //
    switch(event.type) {
        case 'HealPlayer':
            return await healPlayer(event.player)
    }
}
