import { connectionDB } from "@tonylb/mtw-utilities/ts/dynamoDB"

export const generateInvitationCode = async (): Promise<string> => {
    let attempts = 0
    let generatedCode = ''
    while (attempts < 10) {
        attempts += 1
        const numericRandChar = () => (`${Math.floor(Math.random() * 10)}`)
        const alphaRandChar = () => {
            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
            return alphabet[Math.floor(Math.random() * alphabet.length)]
        }
        generatedCode = `${numericRandChar()}${alphaRandChar()}${alphaRandChar()}${numericRandChar()}${numericRandChar()}${alphaRandChar()}`
        const success = await connectionDB.nonCollidingPutItem({
            ConnectionId: `INVITATION#${generatedCode}`,
            DataCategory: 'Meta::Invitation',
            deleteAt: (Date.now() / 1000) + 15 * 24 * 60 * 60
        })
        if (success) {
            break
        }
    }
    if (attempts >= 10) {
        return ''
    }
    return generatedCode
}

export const validateInvitationCode = async (invitationCode: string): Promise<boolean> => {
    const { DataCategory, claimedBy } = (await connectionDB.getItem<{ DataCategory: string; claimedBy?: string }>({
        Key: {
            ConnectionId: `INVITATION#${invitationCode}`,
            DataCategory: 'Meta::Invitation',
        },
        ProjectionFields: ['DataCategory', 'claimedBy']
    })) || {}
    return (DataCategory === 'Meta::Invitation' && !claimedBy)
}
