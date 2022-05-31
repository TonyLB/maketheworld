import { produce } from 'immer'

import { splitType } from '../types.js'

//
// TODO: Replace repeated direct assigns of spaceAfter and spaceBefore with a post-process
// that goes through the list, picks the first spaceBefore, and last spaceAfter,
// elevates them to record level (in TaggedContentJoined or some such) and then purges
// all spaceBefore/spaceAfter from the list of joined arguments
//
const joinRenderItems = function * (render = []) {
    if (render.length > 0) {
        //
        // Use spread-operator to clear the read-only tags that Immer can apply
        //
        let currentItem = { ...render[0] }
        if (currentItem.spaceBefore) {
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
                case 'LineBreak':
                    break
            }
        }
        for (const renderItem of (render.slice(1) || [])) {
            const spaceBetween = currentItem.spaceAfter || renderItem.spaceBefore
            switch(renderItem.tag) {
                case 'String':
                    switch(currentItem.tag) {
                        case 'String':
                            currentItem.value = `${currentItem.value.trimEnd()}${spaceBetween ? ' ' : ''}${renderItem.value.trimLeft()}`
                            currentItem.spaceAfter = renderItem.spaceAfter
                            break
                        case 'Link':
                            yield {
                                ...currentItem,
                                spaceAfter: undefined
                            }
                            currentItem = {
                                ...renderItem,
                                value: `${spaceBetween ? ' ' : ''}${renderItem.value.trimLeft()}`,
                                spaceBefore: undefined
                            }
                            break
                        case 'LineBreak':
                            yield {
                                ...currentItem,
                                spaceAfter: undefined
                            }
                            currentItem = {
                                ...renderItem,
                                value: renderItem.value.trimLeft(),
                                spaceBefore: undefined
                            }
                            break
                    }
                    break
                case 'Link':
                    switch(currentItem.tag) {
                        case 'String':
                            yield {
                                ...currentItem,
                                value: `${currentItem.value.trimEnd()}${spaceBetween ? ' ' : ''}`,
                                spaceAfter: undefined
                            }
                            currentItem = {
                                ...renderItem,
                                spaceBefore: undefined
                            }
                            break
                        case 'Link':
                            yield {
                                ...currentItem,
                                spaceAfter: undefined
                            }
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
                            yield {
                                ...currentItem,
                                spaceAfter: undefined
                            }
                            currentItem = {
                                ...renderItem,
                                spaceBefore: undefined
                            }
                            break;
                    }
                    break
                case 'LineBreak':
                    yield {
                        ...currentItem,
                        value: currentItem.value.trim(),
                        spaceAfter: undefined
                    }
                    currentItem = {
                        ...renderItem,
                        spaceBefore: undefined
                    }
                    break
            }
        }
        yield currentItem
    }
}

const foldSpacingIntoList = ({ render, spaceBefore, spaceAfter }) => (produce(render, (draft) => {
    if (draft && draft.length > 0) {
        draft[0].spaceBefore = draft[0].spaceBefore || spaceBefore
        draft[draft.length - 1].spaceAfter = draft[draft.length - 1].spaceAfter || spaceAfter
    }
}))

export const componentAppearanceReduce = (...renderList) => {
    const joinedList = renderList.reduce((previous, current) => ({
        render: [
            ...(previous.render || []),
            ...(current.render ? foldSpacingIntoList(current) : [])
        ],
        name: [
            ...(previous.name || []),
            ...(current.name || [])
        ],
        features: [
            ...(previous.features || []),
            ...(current.features || [])
        ],
        exits: [
            ...(previous.exits || []),
            ...(current.exits || [])
        ],
    }), { render: [], name: [], features: [], exits: [] })
    return {
        ...joinedList,
        name: joinedList.name.join(''),
        render: [...joinRenderItems(joinedList.render)]
    }
}

export const isComponentTag = (tag) => (['Room', 'Feature'].includes(tag))

export const isComponentKey = (key) => (['ROOM', 'FEATURE'].includes(splitType(key)[0]))
