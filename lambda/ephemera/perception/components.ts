import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { produce } from 'immer'
import { EphemeraFeatureAppearance, EphemeraRoomAppearance } from '../cacheAsset/baseClasses'
import { RoomDescribeData, FeatureDescribeData, TaggedMessageContent } from '@tonylb/mtw-interfaces/dist/messages'
import { ComponentRenderItem } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

//
// TODO: Replace repeated direct assigns of spaceAfter and spaceBefore with a post-process
// that goes through the list, picks the first spaceBefore, and last spaceAfter,
// elevates them to record level (in TaggedContentJoined or some such) and then purges
// all spaceBefore/spaceAfter from the list of joined arguments
//

const renderItemToTaggedMessage = (item: ComponentRenderItem): TaggedMessageContent => {
    if (item.tag === 'LineBreak') {
        return item
    }
    else {
        const { spaceAfter, spaceBefore, ...rest } = item
        return rest
    }
}

const joinRenderItems = function * (render: ComponentRenderItem[] = []): Generator<TaggedMessageContent> {
    if (render.length > 0) {
        //
        // Use spread-operator to clear the read-only tags that Immer can apply
        //
        let currentItem: ComponentRenderItem = { ...render[0] }
        if (currentItem.tag !== 'LineBreak' && currentItem.spaceBefore) {
            switch(currentItem.tag) {
                case 'String':
                    currentItem.value = ` ${currentItem.value}`
                    break
                case 'Link':
                    yield {
                        tag: 'String',
                        value: ' '
                    }
                    break
            }
        }
        for (const renderItem of (render.slice(1) || [])) {
            const currentSpacingDefined = currentItem.tag !== 'LineBreak' && (currentItem.spaceAfter !== undefined || currentItem.spaceBefore !== undefined)
            const renderSpacingDefined = renderItem.tag !== 'LineBreak' && (renderItem.spaceAfter !== undefined || renderItem.spaceBefore !== undefined)
            const spaceBetween = (currentItem.tag !== 'LineBreak' && currentItem.spaceAfter) || (renderItem.tag !== 'LineBreak' && renderItem.spaceBefore)
            switch(renderItem.tag) {
                case 'String':
                    switch(currentItem.tag) {
                        case 'String':
                            currentItem.value = `${currentSpacingDefined ? (currentItem.value || '').trimEnd() : currentItem.value}${spaceBetween ? ' ' : ''}${renderSpacingDefined ? (renderItem.value || '').trimStart() : renderItem.value}`
                            currentItem.spaceAfter = renderItem.spaceAfter
                            break
                        case 'Link':
                            yield renderItemToTaggedMessage(currentItem)
                            currentItem = {
                                ...renderItem,
                                value: `${spaceBetween ? ' ' : ''}${renderSpacingDefined ? (renderItem.value || '').trimStart() : renderItem.value}`,
                                spaceBefore: undefined
                            }
                            break
                        case 'LineBreak':
                            yield renderItemToTaggedMessage(currentItem)
                            currentItem = {
                                ...renderItem,
                                value: renderSpacingDefined ? (renderItem.value || '').trimStart() : renderItem.value,
                                spaceBefore: undefined
                            }
                            break
                    }
                    break
                case 'Link':
                    switch(currentItem.tag) {
                        case 'String':
                            yield renderItemToTaggedMessage({
                                ...currentItem,
                                value: `${currentSpacingDefined ? (currentItem.value || '').trimEnd() : currentItem.value}${spaceBetween ? ' ' : ''}`,
                            })
                            currentItem = {
                                ...renderItem,
                                spaceBefore: undefined
                            }
                            break
                        case 'Link':
                            yield renderItemToTaggedMessage(currentItem)
                            if (spaceBetween) {
                                yield {
                                    tag: 'String',
                                    value: ' '
                                }
                            }
                            currentItem = {
                                ...renderItem,
                                spaceBefore: undefined
                            }
                            break
                        case 'LineBreak':
                            yield renderItemToTaggedMessage(currentItem)
                            currentItem = {
                                ...renderItem,
                                spaceBefore: undefined
                            }
                            break;
                    }
                    break
                case 'LineBreak':
                    yield currentItem.tag === 'String'
                        ? renderItemToTaggedMessage({
                            ...currentItem,
                            value: currentSpacingDefined ? (currentItem.value || '').trim() : currentItem.value
                        })
                        : renderItemToTaggedMessage(currentItem)
                    currentItem = renderItem
                    break
            }
        }
        yield renderItemToTaggedMessage(currentItem)
    }
}

// const foldSpacingIntoList = ({ render, spaceBefore, spaceAfter }: { render: ComponentRenderItem[]; spaceBefore: boolean; spaceAfter: boolean }): ComponentRenderItem[] => (produce(render, (draft) => {
//     if (draft && draft.length > 0) {
//         if (draft[0].tag !== 'LineBreak') {
//             draft[0].spaceBefore = draft[0].spaceBefore || spaceBefore
//         }
//         const endOfList = draft[draft.length - 1]
//         if (endOfList.tag !== 'LineBreak') {
//             endOfList.spaceAfter = endOfList.spaceAfter || spaceAfter
//         }
//     }
// }))

type RenderRoomOutput = Omit<RoomDescribeData, 'RoomId' | 'Characters' | 'Description'> & { Description: ComponentRenderItem[] }
type RenderFeatureOutput = Omit<FeatureDescribeData, 'FeatureId' | 'Description'> & { Description: ComponentRenderItem[] }

const isEphemeraRoomAppearance = (value: EphemeraFeatureAppearance[] | EphemeraRoomAppearance[]): value is EphemeraRoomAppearance[] => (value.length === 0 || 'exits' in value[0])

export function componentAppearanceReduce (...renderList: EphemeraFeatureAppearance[]): Omit<FeatureDescribeData, 'FeatureId'>
export function componentAppearanceReduce (...renderList: EphemeraRoomAppearance[]): Omit<RoomDescribeData, 'RoomId' | 'Characters'>
export function componentAppearanceReduce (...renderList: (EphemeraRoomAppearance[] | EphemeraFeatureAppearance[])): (Omit<RoomDescribeData, 'RoomId' | 'Characters'> | Omit<FeatureDescribeData, 'FeatureId'>) {
    if (renderList.length === 0) {
        return {
            Name: '',
            Description: [],
            Exits: []
        }
    }
    if (isEphemeraRoomAppearance(renderList)) {
        const joinedList = renderList.reduce<RenderRoomOutput>((previous, current) => ({
            Description: [
                ...(previous.Description || []),
                ...(current.render || [])
            ],
            Name: `${previous.Name || ''}${current.name || ''}`,
            // features: [
            //     ...(previous.features || []),
            //     ...(current.features || [])
            // ],
            Exits: [
                ...(previous.Exits || []),
                ...(current.exits.map(({ name, to }) => ({ Name: name, RoomId: splitType(to)[1], Visibility: "Private" as "Private" })) || [])
            ],
        }), { Description: [], Name: '', Exits: [] })
        return {
            ...joinedList,
            Description: [...joinRenderItems(joinedList.Description)]
        }    
    }
    else {
        const joinedList = renderList.reduce<RenderFeatureOutput>((previous, current) => ({
            Description: [
                ...(previous.Description || []),
                ...(current.render || [])
            ],
            Name: `${previous.Name || ''}${current.name || ''}`,
        }), { Description: [], Name: '' })
        return {
            ...joinedList,
            Description: [...joinRenderItems(joinedList.Description)]
        }
    }
}

export const isComponentTag = (tag) => (['Room', 'Feature'].includes(tag))

export const isComponentKey = (key) => (['ROOM', 'FEATURE'].includes(splitType(key)[0]))
