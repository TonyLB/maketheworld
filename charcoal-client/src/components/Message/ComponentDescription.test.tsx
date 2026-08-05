/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import SearchIcon from '@mui/icons-material/Search'
import ComponentDescription from './ComponentDescription'
import {
    PerceptionFeatureMetaData,
    PerceptionKnowledgeMetaData,
    PerceptionObjectMetaData
} from '@tonylb/mtw-interfaces/ts/messages'
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

describe('ComponentDescription', () => {
    describe('Feature', () => {
        it('renders display name and description from DEFAULT situation facet', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature key=(testFeature) uuid=(FEATURE#testFeature)>
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>Test Feature</DisplayName>
                            <Description>A feature from a Situation facet</Description>
                        </Situation>
                    </Feature>
                </Asset>
            `))

            const metaData: PerceptionFeatureMetaData = {
                componentUUID: 'FEATURE#testFeature'
            }

            render(
                <ComponentDescription
                    parsedWML={standardForm}
                    metaData={metaData}
                    icon={<SearchIcon />}
                    onClickLink={noopOnClickLink}
                />
            )

            expect(screen.getByRole('heading', { name: 'Test Feature' })).toBeDefined()
            expect(screen.getByText('A feature from a Situation facet')).toBeDefined()
        })

        it('prefers ephemera render over DEFAULT situation facet', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature key=(testFeature) uuid=(FEATURE#testFeature)>
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>Facet Name</DisplayName>
                            <Description>Facet description</Description>
                        </Situation>
                        <Render>
                            <DisplayName>Render Name</DisplayName>
                            <Summary>Render summary</Summary>
                            <Description>Render description</Description>
                        </Render>
                    </Feature>
                </Asset>
            `), { standardizeMode: 'ephemeraWire' })

            const metaData: PerceptionFeatureMetaData = {
                componentUUID: 'FEATURE#testFeature'
            }

            render(
                <ComponentDescription
                    parsedWML={standardForm}
                    metaData={metaData}
                    icon={<SearchIcon />}
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
                    <Feature key=(testFeature) uuid=(FEATURE#testFeature) />
                </Asset>
            `))

            const metaData: PerceptionFeatureMetaData = {
                componentUUID: 'FEATURE#testFeature'
            }

            render(
                <ComponentDescription
                    parsedWML={standardForm}
                    metaData={metaData}
                    icon={<SearchIcon />}
                    onClickLink={noopOnClickLink}
                />
            )

            expect(screen.getByRole('heading', { name: 'Unknown' })).toBeDefined()
            expect(screen.getByText('No description')).toBeDefined()
        })
    })

    describe('Knowledge', () => {
        it('renders display name and description from DEFAULT situation facet', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Knowledge key=(testKnowledge) uuid=(KNOWLEDGE#testKnowledge)>
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>Test Knowledge</DisplayName>
                            <Description>Knowledge from a Situation facet</Description>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))

            const metaData: PerceptionKnowledgeMetaData = {
                componentUUID: 'KNOWLEDGE#testKnowledge'
            }

            render(
                <ComponentDescription
                    parsedWML={standardForm}
                    metaData={metaData}
                    icon={<SearchIcon />}
                    onClickLink={noopOnClickLink}
                />
            )

            expect(screen.getByRole('heading', { name: 'Test Knowledge' })).toBeDefined()
            expect(screen.getByText('Knowledge from a Situation facet')).toBeDefined()
        })
    })

    describe('Object', () => {
        it('renders shortName as heading with no description', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Object key=(testObject) uuid=(OBJECT#testObject)>
                        <ShortName>A Widget</ShortName>
                    </Object>
                </Asset>
            `), { standardizeMode: 'ephemeraWire' })

            const metaData: PerceptionObjectMetaData = {
                componentUUID: 'OBJECT#testObject'
            }

            render(
                <ComponentDescription
                    parsedWML={standardForm}
                    metaData={metaData}
                    icon={<SearchIcon />}
                    onClickLink={noopOnClickLink}
                />
            )

            expect(screen.getByRole('heading', { name: 'A Widget' })).toBeDefined()
            expect(screen.getByText('No description')).toBeDefined()
        })

        it('renders description from a Render facet, keeping shortName as the heading', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Object key=(testObject) uuid=(OBJECT#testObject)>
                        <ShortName>Rocket Skateboard</ShortName>
                        <Render>
                            <DisplayName>Rocket Skateboard</DisplayName>
                            <Summary></Summary>
                            <Description>Rocket motor on the rear.</Description>
                        </Render>
                    </Object>
                </Asset>
            `), { standardizeMode: 'ephemeraWire' })

            const metaData: PerceptionObjectMetaData = {
                componentUUID: 'OBJECT#testObject'
            }

            render(
                <ComponentDescription
                    parsedWML={standardForm}
                    metaData={metaData}
                    icon={<SearchIcon />}
                    onClickLink={noopOnClickLink}
                />
            )

            expect(screen.getByRole('heading', { name: 'Rocket Skateboard' })).toBeDefined()
            expect(screen.getByText('Rocket motor on the rear.')).toBeDefined()
            expect(screen.queryByText('No description')).toBeNull()
        })

        it('renders description from a DEFAULT situation facet', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Object key=(testObject) uuid=(OBJECT#testObject)>
                        <ShortName>A Widget</ShortName>
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>A Widget</DisplayName>
                            <Description>An object from a Situation facet</Description>
                        </Situation>
                    </Object>
                </Asset>
            `), { standardizeMode: 'ephemeraWire' })

            const metaData: PerceptionObjectMetaData = {
                componentUUID: 'OBJECT#testObject'
            }

            render(
                <ComponentDescription
                    parsedWML={standardForm}
                    metaData={metaData}
                    icon={<SearchIcon />}
                    onClickLink={noopOnClickLink}
                />
            )

            expect(screen.getByRole('heading', { name: 'A Widget' })).toBeDefined()
            expect(screen.getByText('An object from a Situation facet')).toBeDefined()
        })

        it('prefers the Render facet DisplayName over ShortName for the heading when they differ', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Object key=(testObject) uuid=(OBJECT#testObject)>
                        <ShortName>Agatha</ShortName>
                        <Render>
                            <DisplayName>Agatha Panzer von Sparkles III</DisplayName>
                            <Description>A dog of remarkable dignity.</Description>
                        </Render>
                    </Object>
                </Asset>
            `), { standardizeMode: 'ephemeraWire' })

            const metaData: PerceptionObjectMetaData = {
                componentUUID: 'OBJECT#testObject'
            }

            render(
                <ComponentDescription
                    parsedWML={standardForm}
                    metaData={metaData}
                    icon={<SearchIcon />}
                    onClickLink={noopOnClickLink}
                />
            )

            expect(screen.getByRole('heading', { name: 'Agatha Panzer von Sparkles III' })).toBeDefined()
            expect(screen.queryByRole('heading', { name: 'Agatha' })).toBeNull()
            expect(screen.getByText('A dog of remarkable dignity.')).toBeDefined()
        })

        it('falls back to ShortName for the heading when no Render DisplayName is authored', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Object key=(testObject) uuid=(OBJECT#testObject)>
                        <ShortName>Agatha</ShortName>
                        <Render>
                            <Description>A dog of remarkable dignity.</Description>
                        </Render>
                    </Object>
                </Asset>
            `), { standardizeMode: 'ephemeraWire' })

            const metaData: PerceptionObjectMetaData = {
                componentUUID: 'OBJECT#testObject'
            }

            render(
                <ComponentDescription
                    parsedWML={standardForm}
                    metaData={metaData}
                    icon={<SearchIcon />}
                    onClickLink={noopOnClickLink}
                />
            )

            expect(screen.getByRole('heading', { name: 'Agatha' })).toBeDefined()
            expect(screen.getByText('A dog of remarkable dignity.')).toBeDefined()
        })
    })
})
