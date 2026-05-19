/**
* @vitest-environment jsdom
*/
import { vi } from 'vitest'
import { GenericTree, GenericTreeFiltered, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { nestOnChangeChildren, nestOnChangeSubItem, nestTransformTreeReducer } from "./context"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaDescription } from "@tonylb/mtw-base/ts/schema/prose"
import { isSchemaRoom, SchemaRoomTag } from "@tonylb/mtw-base/ts/schema/components"
import { excludeUndefined } from "./lists"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"

describe('context nesting helper library', () => {
    it('should nest onChange with nestOnChangeSubItem', () => {
        const onChange = vi.fn()
        nestOnChangeSubItem({
            tree: [
                { data: { tag: 'String', value: 'A' }, children: [] },
                { data: { tag: 'String', value: 'B' }, children: [] },
                { data: { tag: 'String', value: 'C' }, children: [] }
            ],
            index: 1
        })(onChange)({ data: { tag: 'String', value: 'D' }, children: [] })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith([
            { data: { tag: 'String', value: 'A' }, children: [] },
            { data: { tag: 'String', value: 'D' }, children: [] },
            { data: { tag: 'String', value: 'C' }, children: [] }
        ])
    })

    it('should nest onChange with nestOnChangeChildren', () => {
        const onChange = vi.fn()
        nestOnChangeChildren({
            data: { tag: 'Description' },
            children: [
                { data: { tag: 'String', value: 'A' }, children: [] },
                { data: { tag: 'String', value: 'B' }, children: [] },
                { data: { tag: 'String', value: 'C' }, children: [] }
            ]
        })(onChange)([
            { data: { tag: 'String', value: 'A' }, children: [] },
            { data: { tag: 'String', value: 'D' }, children: [] },
            { data: { tag: 'String', value: 'C' }, children: [] }
        ])
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith({
            data: { tag: 'Description' },
            children: [
                { data: { tag: 'String', value: 'A' }, children: [] },
                { data: { tag: 'String', value: 'D' }, children: [] },
                { data: { tag: 'String', value: 'C' }, children: [] }
            ]
        })
    })

    it('should combine nesting', () => {
        const onChange = vi.fn()
        const testSchema: GenericTree<SchemaTag> = [{
            data: { tag: 'Description' },
            children: [
                { data: { tag: 'String', value: 'A' }, children: [] },
                { data: { tag: 'String', value: 'B' }, children: [] },
                { data: { tag: 'String', value: 'C' }, children: [] }
            ]
        }]
        nestOnChangeSubItem({ tree: testSchema[0].children, index: 1 })(nestOnChangeChildren(testSchema[0])(nestOnChangeSubItem({ tree: testSchema, index: 0 })(onChange)))({ data: { tag: 'String', value: 'D' }, children: [] })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith([{
            data: { tag: 'Description' },
            children: [
                { data: { tag: 'String', value: 'A' }, children: [] },
                { data: { tag: 'String', value: 'D' }, children: [] },
                { data: { tag: 'String', value: 'C' }, children: [] }
            ]
        }])
    })

    it('should transform baseReducer with nestTransformTreeReducer', () => {
        const testSchema: GenericTree<SchemaTag> = [{
            data: { tag: 'Description' },
            children: [
                { data: { tag: 'String', value: 'A' }, children: [] },
                { data: { tag: 'String', value: 'B' }, children: [] },
                { data: { tag: 'String', value: 'C' }, children: [] }
            ]
        }]

        const mappedReducer = nestTransformTreeReducer(
            (baseReducer, { parentData } = {}) => (previous, newValue) => {
                if (parentData && isSchemaDescription(parentData)) {
                    const previousLength = (previous ?? []).length
                    return baseReducer(previous, [
                        ...(newValue.slice(0, previousLength)),
                        ...((newValue.length > previousLength) ? [{ data: { tag: 'br' as const }, children: [] }] : []),
                        ...(newValue.slice(previousLength))
                    ].filter(excludeUndefined) as GenericTree<SchemaTag>)
                }
                else {
                    return baseReducer(previous, newValue.filter(excludeUndefined) as GenericTree<SchemaTag>)
                }
            }
        )
        expect(mappedReducer(testSchema, [{
            data: { tag: 'Description' },
            children: [
                undefined,
                { data: { tag: 'String', value: 'B' }, children: [] },
                { data: { tag: 'String', value: 'C' }, children: [] },
                { data: { tag: 'String', value: 'D' }, children: [] }
            ]
        }])).toEqual([{
            data: { tag: 'Description' },
            children: [
                { data: { tag: 'String', value: 'B' }, children: [] },
                { data: { tag: 'String', value: 'C' }, children: [] },
                { data: { tag: 'br' }, children: [] },
                { data: { tag: 'String', value: 'D' }, children: [] }
            ]
        }])
    })

    it('should output supplemental actions in nestTransformTreeReducer', () => {
        const testSchema: GenericTree<SchemaTag> = [
            { data: { tag: 'Room', key: 'Room1' }, children: [{ data: { tag: 'Position', x: 0, y: 0 }, children: [] }]}
        ]

        const addSupplement = vi.fn()
        const mappedReducer = nestTransformTreeReducer(
            (baseReducer, _, addSupplement) => (previous, newValue) => {
                const previousLength = (previous ?? []).length
                const newRooms = newValue.slice(previousLength).filter((node) => (node && treeNodeTypeguard(isSchemaRoom)({ ...node, children: [] }))).filter(excludeUndefined) as GenericTreeFiltered<SchemaRoomTag, SchemaTag>
                newRooms.forEach((newRoom) => {
                    addSupplement({
                        type: 'update',
                        update: (draft: StandardForm) => {
                            if (!(newRoom.data.key in draft.byId)) {
                                draft.byId[newRoom.data.key] = new StandardRoom(newRoom.data.key)
                            }
                            return draft
                        }
                    })
                })
                return baseReducer(previous, newValue as GenericTree<SchemaTag>)
            },
            (_, newValue) => (newValue),
            addSupplement
        )
        expect(mappedReducer(testSchema, [
            {
                data: { tag: 'Room', key: 'Room1' },
                children: [
                    { data: { tag: 'Position', x: 0, y: 0 }, children: [] },
                    { data: { tag: 'Exit', from: 'Room1', to: 'Room2', key: 'Room1:Room2' }, children: [{ data: { tag: 'String', value: 'out' }, children: [] }] }
                ]
            },
            {
                data: { tag: 'Room', key: 'Room2' },
                children: [
                    { data: { tag: 'Position', x: 0, y: 100 }, children: [] },
                    { data: { tag: 'Exit', from: 'Room2', to: 'Room1', key: 'Room2:Room1' }, children: [{ data: { tag: 'String', value: 'enter' }, children: [] }] }
                ]
            }
        ])).toEqual([
            {
                data: { tag: 'Room', key: 'Room1' },
                children: [
                    { data: { tag: 'Position', x: 0, y: 0 }, children: [] },
                    { data: { tag: 'Exit', from: 'Room1', to: 'Room2', key: 'Room1:Room2' }, children: [{ data: { tag: 'String', value: 'out' }, children: [] }] }
                ]
            },
            {
                data: { tag: 'Room', key: 'Room2' },
                children: [
                    { data: { tag: 'Position', x: 0, y: 100 }, children: [] },
                    { data: { tag: 'Exit', from: 'Room2', to: 'Room1', key: 'Room2:Room1' }, children: [{ data: { tag: 'String', value: 'enter' }, children: [] }] }
                ]
            }
        ])
        expect(addSupplement).toHaveBeenCalledTimes(1)
        expect(addSupplement).toHaveBeenCalledWith({
            type: 'update',
            update: expect.any(Function)
        })
    })

})