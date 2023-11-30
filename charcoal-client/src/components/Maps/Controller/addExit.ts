import { NormalForm, isNormalRoom } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { UpdateNormalPayload } from "../../../slices/personalAssets/reducers"

export const addExitFactory = ({ normalForm, updateNormal }: { normalForm: NormalForm, updateNormal: (action: UpdateNormalPayload) => void }) => ({ to, from }: { to: string; from: string }) => {
    console.log(`Add Exit: ${from} => ${to}`)
    const normalRoom = normalForm[from || '']
    if (from && normalRoom && isNormalRoom(normalRoom)) {
        const firstUnconditionedAppearance = normalRoom.appearances.findIndex(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
        if (firstUnconditionedAppearance !== -1) {
            updateNormal({
                type: 'put',
                item: {
                    tag: 'Exit',
                    key: `${from}#${to}`,
                    from,
                    to,
                    name: '',
                    contents: [],
                },
                position: { contextStack: [ ...normalRoom.appearances[firstUnconditionedAppearance].contextStack, { key: from, tag: 'Room', index: firstUnconditionedAppearance }] }
            })
        }
    }
}
