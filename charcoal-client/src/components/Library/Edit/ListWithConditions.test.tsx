import renderer from 'react-test-renderer'
import { FunctionComponent } from 'react'

import ListWithConditions from './ListWithConditions'
import { isSchemaExit, isSchemaOutputTag, SchemaExitTag, SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { GenericTreeNodeFiltered } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import { treeTypeGuard } from '@tonylb/mtw-wml/dist/tree/filter'
import { EditSchema } from './EditContext'

describe('ListWithConditions component', () => {
    const render: FunctionComponent<{ item: GenericTreeNodeFiltered<SchemaExitTag, SchemaTag> }> = ({ item }) => {
        return <div>{ `'${item.data.from}' to '${item.data.to}': ${schemaOutputToString(treeTypeGuard({ typeGuard: isSchemaOutputTag, tree: item.children }))}` }</div>
    }
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