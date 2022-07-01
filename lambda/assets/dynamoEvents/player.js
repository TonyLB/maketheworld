import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { generatePersonalAssetLibrary } from "@tonylb/mtw-utilities/dist/selfHealing/index"
import { SocketQueue } from '@tonylb/mtw-utilities/dist/apiManagement/index'

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
