import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { EphemeraFeatureAppearance, EphemeraRoomAppearance } from '../cacheAsset/baseClasses'
import { RoomDescribeData, FeatureDescribeData, TaggedMessageContent } from '@tonylb/mtw-interfaces/dist/messages'

type RenderRoomOutput = Omit<RoomDescribeData, 'RoomId' | 'Characters'>
type RenderFeatureOutput = Omit<FeatureDescribeData, 'FeatureId'>

const isEphemeraRoomAppearance = (value: EphemeraFeatureAppearance[] | EphemeraRoomAppearance[]): value is EphemeraRoomAppearance[] => (value.length === 0 || 'exits' in value[0])

const joinMessageItems = function * (render: TaggedMessageContent[] = []): Generator<TaggedMessageContent> {
    if (render.length > 0) {
        //
        // Use spread-operator to clear the read-only tags that Immer can apply
        //
        let currentItem: TaggedMessageContent = { ...render[0] }
        for (const renderItem of (render.slice(1) || [])) {
            switch(renderItem.tag) {
                case 'String':
                    switch(currentItem.tag) {
                        case 'String':
                            currentItem.value = `${currentItem.value}${renderItem.value}`
                            break
                        case 'Link':
                        case 'LineBreak':
                            yield currentItem
                            currentItem = { ...renderItem }
                            break
                    }
                    break
                case 'Link':
                case 'LineBreak':
                    yield currentItem
                    currentItem = { ...renderItem }
                    break
            }
        }
        yield currentItem
    }
}
export function componentAppearanceReduce (...renderList: EphemeraFeatureAppearance[]): Omit<FeatureDescribeData, 'FeatureId'>
export function componentAppearanceReduce (...renderList: EphemeraRoomAppearance[]): Omit<RoomDescribeData, 'RoomId' | 'Characters'>
export function componentAppearanceReduce (...renderList: (EphemeraRoomAppearance[] | EphemeraFeatureAppearance[])): (Omit<RoomDescribeData, 'RoomId' | 'Characters'> | Omit<FeatureDescribeData, 'FeatureId'>) {
    if (renderList.length === 0) {
        return {
            Name: [],
            Description: [],
            Exits: []
        }
    }
    if (isEphemeraRoomAppearance(renderList)) {
        const joinedList = renderList.reduce<RenderRoomOutput>((previous, current) => ({
            Description: [ ...joinMessageItems([
                ...(previous.Description || []),
                ...(current.render || [])
            ])],
            Name: [ ...joinMessageItems([...previous.Name, ...current.name]) ],
            Exits: [
                ...(previous.Exits || []),
                ...(current.exits.map(({ name, to }) => ({ Name: name, RoomId: to, Visibility: "Private" as "Private" })) || [])
            ],
        }), { Description: [], Name: [], Exits: [] })
        return joinedList
    }
    else {
        const joinedList = renderList.reduce<RenderFeatureOutput>((previous, current) => ({
            Description: [ ...joinMessageItems([
                ...(previous.Description || []),
                ...(current.render || [])
            ])],
            Name: [ ...joinMessageItems([...previous.Name, ...current.name])]
        }), { Description: [], Name: [] })
        return joinedList
    }
}

export const isComponentTag = (tag) => (['Room', 'Feature'].includes(tag))

export const isComponentKey = (key) => (['ROOM', 'FEATURE'].includes(splitType(key)[0]))
