jest.mock('./CodeEditor')
import CodeEditor from './CodeEditor'

import renderer from 'react-test-renderer'
import { FunctionComponent } from 'react'

import ListWithConditions from './ListWithConditions'
import { isSchemaExit, isSchemaOutputTag, SchemaExitTag, SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { GenericTreeNodeFiltered, treeNodeTypeguard } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import { EditSchema, useEditContext } from './EditContext'
import { treeTypeGuard } from '@tonylb/mtw-wml/dist/tree/filter'

describe('ListWithConditions component', () => {
    const render: FunctionComponent<{ item: GenericTreeNodeFiltered<SchemaExitTag, SchemaTag> }> = ({}) => {
        const { field: item } = useEditContext()
        if (!treeNodeTypeguard(isSchemaExit)(item)) {
            console.log(`item: ${JSON.stringify(item, null, 4)}`)
            throw new Error('Non-exit passed to render')
        }
        return <div>{ `'${item.data.from}' to '${item.data.to}': ${schemaOutputToString(treeTypeGuard({ typeGuard: isSchemaOutputTag, tree: item.children }))}` }</div>
    }

    beforeEach(() => {
        (CodeEditor as jest.Mock).mockReturnValue(null)
    })

    it('renders non-conditions correctly', () => {
        expect(renderer
            .create(
                <EditSchema
                    field={{ data: { tag: 'Room', key: 'room1' }, children: [], id: '' }}
                    value={[
                        { data: { tag: 'Exit', from: 'room1', to: 'room2', key: 'room1#room2' }, children: [{ data: { tag: 'String', value: 'closet' }, children: [] }]},
                        { data: { tag: 'Exit', from: 'room1', to: 'room3', key: 'room1#room3' }, children: [{ data: { tag: 'String', value: 'lobby' }, children: [] }]}
                    ]}
                    onChange={() => {}}
                    onDelete={() => {}}
                >
                    <ListWithConditions
                        typeGuard={isSchemaExit}
                        render={render}
                    />
                </EditSchema>
            ).toJSON()
        ).toMatchSnapshot()
    })

    it('renders conditions correctly', () => {
        expect(renderer
            .create(
                <EditSchema
                    field={{ data: { tag: 'Room', key: 'room1' }, children: [], id: '' }}
                    value={[
                        { data: { tag: 'Exit', from: 'room1', to: 'room2', key: 'room1#room2' }, children: [{ data: { tag: 'String', value: 'closet' }, children: [] }]},
                        { data: { tag: 'If' }, children: [
                            { data: { tag: 'Statement', if: 'true' }, children: [
                                { data: { tag: 'Exit', from: 'room1', to: 'room3', key: 'room1#room3' }, children: [{ data: { tag: 'String', value: 'lobby' }, children: [] }]}
                            ] }
                        ] }
                    ]}
                    onChange={() => {}}
                    onDelete={() => {}}
                >
                    <ListWithConditions
                        typeGuard={isSchemaExit}
                        render={render}
                    />
                </EditSchema>
            ).toJSON()
        ).toMatchSnapshot()
    })

})