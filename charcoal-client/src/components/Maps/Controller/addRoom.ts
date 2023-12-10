import { NormalForm, isNormalMap } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { UpdateNormalPayload } from "../../../slices/personalAssets/reducers"

export const addRoomFactory = ({ mapId, normalForm, updateNormal }: { mapId: string; normalForm: NormalForm, updateNormal: (action: UpdateNormalPayload) => void }) => ({ roomId, x, y }: { roomId: string; x: number; y: number }) => {
    const normalMap = normalForm[mapId || '']
    if (normalMap && isNormalMap(normalMap)) {
        const firstUnconditionedAppearance = normalMap.appearances.findIndex(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
        if (firstUnconditionedAppearance !== -1) {
            updateNormal({
                type: 'put',
                item: {
                    tag: 'Room',
                    key: roomId,
                    x,
                    y,
                    name: [],
                    render: [],
                    contents: [],
                },
                position: { contextStack: [ ...normalMap.appearances[firstUnconditionedAppearance].contextStack, { key: mapId, tag: 'Map', index: firstUnconditionedAppearance }] }
            })
        }
    }
}
