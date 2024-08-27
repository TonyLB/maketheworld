import renderer from 'react-test-renderer'
import React, { FunctionComponent, useEffect } from 'react'

import { useEditContext, EditSchema, EditSubListSchema } from './EditContext'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import { treeTypeGuard } from '@tonylb/mtw-wml/dist/tree/filter'
import { isSchemaOutputTag, SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { maybeGenericIDFromTree, stripIDFromTree } from '@tonylb/mtw-wml/dist/tree/genericIDTree'
import { GenericTree } from '@tonylb/mtw-wml/dist/tree/baseClasses'

const Render: FunctionComponent<{}> = () => {
    const { value } = useEditContext()
    return <React.Fragment>
        { schemaOutputToString(treeTypeGuard({ tree: value, typeGuard: isSchemaOutputTag })) }
    </React.Fragment>
}

describe('EditSchema', () => {

    it('should provide value for children', () => {
        expect(renderer
            .create(
                <EditSchema
                    field={{ data: { tag: 'String', value: 'Test' }, children: [], id: '' }}
                    value={[{ data: { tag: 'String', value: 'Test' }, children: [] }]}
                    onChange={() => {}}
                    onDelete={() => {}}
                >
                    <Render />
                </EditSchema>
            ).toJSON()
        ).toMatchSnapshot()

    })
})

describe('EditSubListSchema', () => {
    const testSchema: GenericTree<SchemaTag> = [
        { data: { tag: 'String', value: 'Test1' }, children: [] },
        { data: { tag: 'String', value: 'Test2' }, children: [] },
        { data: { tag: 'String', value: 'Test3' }, children: [] }
    ]

    it('should extract an indexed value from node children', () => {
        expect(renderer
            .create(
                <EditSchema
                    field={maybeGenericIDFromTree(testSchema)[0]}
                    value={testSchema}
                    onChange={() => {}}
                    onDelete={() => {}}
                >
                    <EditSubListSchema index={1}>
                        <Render />
                    </EditSubListSchema>
                </EditSchema>
            ).toJSON()
        ).toMatchSnapshot()
    })

    it('should bubble up onChange events', () => {
        const ChangeRender: FunctionComponent<{}> = () => {
            const { onChange } = useEditContext()
            useEffect(() => {
                onChange([{ data: { tag: 'String', value: 'Test change' }, children: [], id: '' }])
            }, [])
            return <Render />
        }
        const onChange = jest.fn()
        renderer.act(() => {
            renderer.create(
                <EditSchema
                    field={maybeGenericIDFromTree(testSchema)[0]}
                    value={testSchema}
                    onChange={onChange}
                    onDelete={() => {}}
                >
                    <EditSubListSchema index={1}>
                        <ChangeRender />
                    </EditSubListSchema>
                </EditSchema>
            )
        })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(stripIDFromTree(onChange.mock.calls[0][0])).toEqual([
            { data: { tag: 'String', value: 'Test1' }, children: [] },
            { data: { tag: 'String', value: 'Test change' }, children: [] },
            { data: { tag: 'String', value: 'Test3' }, children: [] }
        ])
    })

    it('should bubble up onDelete events', () => {
        const ChangeRender: FunctionComponent<{}> = () => {
            const { onDelete } = useEditContext()
            useEffect(() => {
                onDelete()
            }, [])
            return <Render />
        }
        const onChange = jest.fn()
        renderer.act(() => {
            renderer.create(
                <EditSchema
                    field={maybeGenericIDFromTree(testSchema)[0]}
                    value={testSchema}
                    onChange={onChange}
                    onDelete={() => {}}
                >
                    <EditSubListSchema index={1}>
                        <ChangeRender />
                    </EditSubListSchema>
                </EditSchema>
            )
        })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(stripIDFromTree(onChange.mock.calls[0][0])).toEqual([
            { data: { tag: 'String', value: 'Test1' }, children: [] },
            { data: { tag: 'String', value: 'Test3' }, children: [] }
        ])
    })
})