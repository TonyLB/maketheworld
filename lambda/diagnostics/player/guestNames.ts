//
// A list of mostly gender-agnostic names that can be used to synthetically create
// guest characters that can be combined with they/them gender for a non-assumption
// first experience

import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

//
export const guestNames = [
    'Alexis',
    'Billie',
    'Casey',
    'Chris',
    'Dana',
    'Ellis',
    'Harper',
    'Jessie',
    'Jordan',
    'Kit',
    'Lindsey',
    'Morgan',
    'Parker',
    'Quinn',
    'Riley',
    'Robin',
    'Sam',
    'Sidney',
    'Taylor',
]

export const newGuestName = async (): Promise<string> => {
    const currentTime = Date.now()
    const baseName = guestNames[currentTime % guestNames.length]
    const value = (await assetDB.optimisticUpdate({
        Key: {
            AssetId: `Global`,
            DataCategory: 'GuestNameCounters'
        },
        updateKeys: ['Name'],
        updateReducer: (draft) => {
            if (!('Name' in draft)) {
                draft.Name = {}
            }
            if (!(baseName in draft.Name)) {
                draft.Name[baseName] = 0
            }
            draft.Name[baseName]++
        },
        ReturnValues: 'UPDATED_NEW'
    })) || { Name: {} }
    const nameCount = value.Name[baseName]
    if (!nameCount) {
        throw new Error('Failure in add Guest name')
    }
    return `${baseName}${nameCount}`
}
