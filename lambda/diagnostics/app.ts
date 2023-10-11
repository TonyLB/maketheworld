import { healPlayer } from "./player"

export const handler = async (event) => {

    switch(event.type) {
        case 'HealPlayer':
            return await healPlayer(event.player)
    }
}
