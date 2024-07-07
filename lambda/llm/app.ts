import { roomGenerate } from "./roomGenerate"

export const handler = async (event) => {

    switch(event.type) {
        case 'RoomGenerate':
            return await roomGenerate(event.name)
    }
    return { message: 'Invalid inputs'}
}
