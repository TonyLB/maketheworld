import { unique } from "mtw-utilities/lists.js"
import { generatePersonalAssetLibrary } from "mtw-utilities/selfHealing/index.js"
import { SocketQueue } from 'mtw-utilities/apiManagement/index.js'

export const handlePlayerEvents = async ({ events }) => {
    const playersToUpdate = unique(
        events
            .filter(({ oldImage, newImage }) => (oldImage.player || newImage.player))
            .filter(({ oldImage, newImage }) => ((oldImage.player || '') !== (newImage.player || '')))
            .reduce((previous, { oldImage, newImage }) => ([
                ...previous,
                oldImage.player || '',
                newImage.player || ''
            ]), [])
            .filter((value) => (value))
    )

    const socketQueue = new SocketQueue()
    const publishPlayerLibraryUpdate = async (playerName) => {
        const { Characters, Assets } = await generatePersonalAssetLibrary(playerName)
        socketQueue.sendPlayer({
            PlayerName: playerName,
            Message: {
                messageType: 'Player',
                PlayerName: playerName,
                Assets,
                Characters
            }
        })
    }
    await Promise.all(playersToUpdate.map(publishPlayerLibraryUpdate))
    await socketQueue.flush()
}
