import { generateLibrary } from "mtw-utilities/selfHealing/index.js"
import { SocketQueue } from 'mtw-utilities/apiManagement/index.js'
import { ephemeraDB } from "mtw-utilities/dynamoDB/index.js"

export const handleLibraryEvents = async ({ events }) => {
    const anyLibraryUpdates = (events
            .filter(({ oldImage, newImage }) => (oldImage.zone === 'Library' || newImage.zone === 'Library'))
            .filter(({ oldImage, newImage }) => ((oldImage.zone || '') !== (newImage.zone || '')))).length > 0

    if (anyLibraryUpdates) {
        const { ConnectionIds: librarySubscriptions } = await ephemeraDB.getItem({
            EphemeraId: 'Library',
            DataCategory: 'Subscriptions',
            ProjectionFields: ['ConnectionIds']
        })
        if (librarySubscriptions.length > 0) {
            const { Assets, Characters } = await generateLibrary()
            const socketQueue = new SocketQueue()
            librarySubscriptions.forEach((ConnectionId) => {
                socketQueue.send({
                    ConnectionId,
                    Message: {
                        messageType: 'Library',
                        Assets,
                        Characters
                    }
                })
            })
            await socketQueue.flush()
        }    
    }
}
