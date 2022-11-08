import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { EphemeraBookmarkAppearance, EphemeraFeatureAppearance, EphemeraRoomAppearance } from '../cacheAsset/baseClasses'
import { RoomDescribeData, FeatureDescribeData, flattenTaggedMessageContent, TaggedMessageContentFlat, BookmarkDescribeData } from '@tonylb/mtw-interfaces/dist/messages'
import { evaluateConditional, filterAppearances } from './utils'
import internalCache from '../internalCache'

type RenderRoomOutput = Omit<RoomDescribeData, 'RoomId' | 'Characters'>
type RenderFeatureOutput = Omit<FeatureDescribeData, 'FeatureId'>
type RenderBookmarkOutput = Omit<BookmarkDescribeData, 'BookmarkId'>

const isEphemeraRoomAppearance = (value: EphemeraFeatureAppearance[] | EphemeraRoomAppearance[] | EphemeraBookmarkAppearance[]): value is EphemeraRoomAppearance[] => (value.length === 0 || 'exits' in value[0])
const isEphemeraFeatureAppearance = (value: EphemeraFeatureAppearance[] | EphemeraRoomAppearance[] | EphemeraBookmarkAppearance[]): value is EphemeraFeatureAppearance[] => (value.length === 0 || (!('exits' in value[0]) && 'name' in value[0]))

const joinMessageItems = function * (render: TaggedMessageContentFlat[] = []): Generator<TaggedMessageContentFlat> {
    if (render.length > 0) {
        //
        // Use spread-operator to clear the read-only tags that Immer can apply
        //
        let currentItem: TaggedMessageContentFlat = { ...render[0] }
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

export async function componentAppearanceReduce (...renderList: EphemeraFeatureAppearance[]): Promise<RenderFeatureOutput>
export async function componentAppearanceReduce (...renderList: EphemeraBookmarkAppearance[]): Promise<RenderBookmarkOutput>
export async function componentAppearanceReduce (...renderList: EphemeraRoomAppearance[]): Promise<RenderRoomOutput>
export async function componentAppearanceReduce (...renderList: (EphemeraRoomAppearance[] | EphemeraFeatureAppearance[] | EphemeraBookmarkAppearance[])): Promise<RenderRoomOutput | RenderFeatureOutput | RenderBookmarkOutput> {
    if (renderList.length === 0) {
        return {
            Name: [],
            Description: [],
            Exits: []
        }
    }
    if (isEphemeraRoomAppearance(renderList)) {
        const flattenedList = await Promise.all(
            renderList.map(({ render, name, exits, ...rest }) => (
                Promise.all([
                    flattenTaggedMessageContent(render, { evaluateConditional }),
                    flattenTaggedMessageContent(name, { evaluateConditional }),
                    filterAppearances((address) => (internalCache.EvaluateCode.get(address)))(exits)
                ]).then(([render, name, exits]) => ({ render, name, exits, ...rest }))
            ))
        )
        const joinedList = flattenedList.reduce<RenderRoomOutput>((previous, current) => ({
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
    else if (isEphemeraFeatureAppearance(renderList)) {
        const flattenedList = await Promise.all(
            renderList.map(({ render, name, ...rest }) => (
                Promise.all([
                    flattenTaggedMessageContent(render, { evaluateConditional }),
                    flattenTaggedMessageContent(name, { evaluateConditional })
                ]).then(([render, name]) => ({ render, name, ...rest }))
            ))
        )
        const joinedList = flattenedList.reduce<RenderFeatureOutput>((previous, current) => ({
            Description: [ ...joinMessageItems([
                ...(previous.Description || []),
                ...(current.render || [])
            ])],
            Name: [ ...joinMessageItems([...previous.Name, ...current.name])]
        }), { Description: [], Name: [] })
        return joinedList
    }
    else {
        const flattenedList = await Promise.all(
            renderList.map(({ render, ...rest }) => (
                    flattenTaggedMessageContent(render, { evaluateConditional })
                ).then((render) => ({ render, ...rest }))
            )
        )
        const joinedList = flattenedList.reduce<RenderBookmarkOutput>((previous, current) => ({
            Description: [ ...joinMessageItems([
                ...(previous.Description || []),
                ...(current.render || [])
            ])],
        }), { Description: [] })
        return joinedList
    }
}

export const isComponentTag = (tag) => (['Room', 'Feature', 'Bookmark'].includes(tag))

export const isComponentKey = (key) => (['ROOM', 'FEATURE', 'BOOKMARK'].includes(splitType(key)[0]))
