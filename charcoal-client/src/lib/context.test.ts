import { GenericTree, GenericTreeWithUndefined, treeNodeTypeguard } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { nestOnChangeChildren, nestOnChangeSubItem, nestTransformTreeReducer } from "./context"
import { isSchemaDescription, isSchemaRoom, SchemaTag, SchemaWithKey } from "@tonylb/mtw-wml/dist/schema/baseClasses"

describe('context nesting helper library', () => {
    it('should nest onChange with nestOnChangeSubItem', () => {
        const onChange = jest.fn()
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
        const onChange = jest.fn()
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
        const onChange = jest.fn()
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
                    ])
                }
                else {
                    return baseReducer(previous, newValue)
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

        const addSupplement = jest.fn()
        const mappedReducer = nestTransformTreeReducer(
            (baseReducer, _, addSupplement) => (previous, newValue) => {
                const previousLength = (previous ?? []).length
                newValue.slice(previousLength).filter(treeNodeTypeguard(isSchemaRoom)).forEach((newRoom) => {
                    addSupplement({ type: 'addComponent', componentKey: newRoom.data.key, tag: 'Room' })
                })
                return baseReducer(previous, newValue)
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
            type: 'addComponent',
            componentKey: 'Room2',
            tag: 'Room'
        })
    })

})