/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import CharacterDescription from './CharacterDescription'
import { PerceptionCharacterMetaData, PerceptionMessage } from '@tonylb/mtw-interfaces/ts/messages'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { vi } from 'vitest'

vi.mock('./RenderTreeContent', () => ({
    default: ({ list }: { list: unknown[] }) => (
        <div data-testid="render-tree">
            {Array.isArray(list) ? list.join(' ') : String(list)}
        </div>
    )
}))

const noopOnClickLink = () => {}

const baseMessage = (metaData: PerceptionCharacterMetaData, parsedWML: StandardForm): PerceptionMessage & { parsedWML: StandardForm } => ({
    DisplayProtocol: 'PerceptionMessage',
    wmlContent: '',
    metaData,
    MessageId: 'MESSAGE#test',
    CreatedTime: 0,
    parsedWML,
})

describe('CharacterDescription', () => {
    it('renders display name and description from DEFAULT situation facet', () => {
        const standardForm = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Character key=(testCharacter) uuid=(CHARACTER#testCharacter)>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Test Character</DisplayName>
                        <Description>A character from a Situation facet</Description>
                    </Situation>
                </Character>
            </Asset>
        `))

        const metaData: PerceptionCharacterMetaData = {
            componentUUID: 'CHARACTER#testCharacter'
        }

        render(
            <CharacterDescription
                message={baseMessage(metaData, standardForm)}
                onClickLink={noopOnClickLink}
            />
        )

        expect(screen.getByRole('heading', { name: 'Test Character' })).toBeDefined()
        expect(screen.getByText('A character from a Situation facet')).toBeDefined()
    })

    it('prefers ephemera render over DEFAULT situation facet', () => {
        const standardForm = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Character key=(testCharacter) uuid=(CHARACTER#testCharacter)>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Facet Name</DisplayName>
                        <Description>Facet description</Description>
                    </Situation>
                    <Render>
                        <DisplayName>Render Name</DisplayName>
                        <Summary>Render summary</Summary>
                        <Description>Render description</Description>
                    </Render>
                </Character>
            </Asset>
        `), { standardizeMode: 'ephemeraWire' })

        const metaData: PerceptionCharacterMetaData = {
            componentUUID: 'CHARACTER#testCharacter'
        }

        render(
            <CharacterDescription
                message={baseMessage(metaData, standardForm)}
                onClickLink={noopOnClickLink}
            />
        )

        expect(screen.getByRole('heading', { name: 'Render Name' })).toBeDefined()
        expect(screen.getByText('Render description')).toBeDefined()
        expect(screen.queryByText('Facet Name')).toBeNull()
    })

    it('shows safe defaults when prose is missing', () => {
        const standardForm = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Character key=(testCharacter) uuid=(CHARACTER#testCharacter) />
            </Asset>
        `))

        const metaData: PerceptionCharacterMetaData = {
            componentUUID: 'CHARACTER#testCharacter'
        }

        render(
            <CharacterDescription
                message={baseMessage(metaData, standardForm)}
                onClickLink={noopOnClickLink}
            />
        )

        expect(screen.getByRole('heading', { name: 'Unknown' })).toBeDefined()
        expect(screen.getByText('No description')).toBeDefined()
    })

    it('throws when given non-character metadata (routing bug guard)', () => {
        const standardForm = new StandardForm(deIndentWML(`
            <Asset uuid=(test)><Feature key=(testFeature) uuid=(FEATURE#testFeature) /></Asset>
        `))
        const badMessage = baseMessage(
            { componentUUID: 'CHARACTER#testCharacter' },
            standardForm
        )
        // @ts-expect-error deliberately mismatched metaData to prove the routing guard fires
        badMessage.metaData = { componentUUID: 'FEATURE#testFeature' }

        expect(() => render(
            <CharacterDescription message={badMessage} onClickLink={noopOnClickLink} />
        )).toThrow(/non-character metadata/)
    })
})
