import addGhostSession from "./addGhostSession"

export const handler = async (event) => {

    switch(event.type) {
        case 'ghostSession':
            await addGhostSession({ characterId: event.characterId })
            break
    }
}
