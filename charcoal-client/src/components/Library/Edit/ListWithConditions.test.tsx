jest.mock('./CodeEditor')
import CodeEditor from './CodeEditor'

import renderer from 'react-test-renderer'
import React, { FunctionComponent } from 'react'

import ListWithConditions from './ListWithConditions'
import { isSchemaExit, isSchemaOutputTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { treeNodeTypeguard } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import { EditSchema, useEditContext } from './EditContext'
import { treeTypeGuard } from '@tonylb/mtw-wml/dist/tree/filter'

describe('ListWithConditions component', () => {
    const render: FunctionComponent<{}> = () => {
        const { value } = useEditContext()
        return <React.Fragment>
            { value
                .filter(treeNodeTypeguard(isSchemaExit))
                .map(({ data, children }) => (<div>{ `'${data.from}' to '${data.to}': ${schemaOutputToString(treeTypeGuard({ typeGuard: isSchemaOutputTag, tree: children }))}` }</div>))
            }
        </React.Fragment>
    }

    beforeEach(() => {
        (CodeEditor as jest.Mock).mockReturnValue(null)
    })

    it('renders non-conditions correctly', () => {
        expect(renderer
            .create(
                <EditSchema
                    value={[
                        { data: { tag: 'Exit', from: 'room1', to: 'room2', key: 'room1#room2' }, children: [{ data: { tag: 'String', value: 'closet' }, children: [] }]},
                        { data: { tag: 'Exit', from: 'room1', to: 'room3', key: 'room1#room3' }, children: [{ data: { tag: 'String', value: 'lobby' }, children: [] }]}
                    ]}
                    onChange={() => {}}
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
                    value={[
                        { data: { tag: 'Exit', from: 'room1', to: 'room2', key: 'room1#room2' }, children: [{ data: { tag: 'String', value: 'closet' }, children: [] }]},
                        { data: { tag: 'If' }, children: [
                            { data: { tag: 'Statement', if: 'true' }, children: [
                                { data: { tag: 'Exit', from: 'room1', to: 'room3', key: 'room1#room3' }, children: [{ data: { tag: 'String', value: 'lobby' }, children: [] }]}
                            ] }
                        ] }
                    ]}
                    onChange={() => {}}
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