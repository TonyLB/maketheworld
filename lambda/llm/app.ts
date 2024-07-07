import { roomGeneratePrompt } from "./roomGenerate"

export const handler = async (event) => {

    switch(event.type) {
        case 'RoomGenerate':
            const prompt = await roomGeneratePrompt(event.name)
            return { prompt }
    }
    throw new Error('Invalid input type')
}
