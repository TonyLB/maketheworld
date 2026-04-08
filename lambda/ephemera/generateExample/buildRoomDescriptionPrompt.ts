//
// Build a single plain-text prompt for the LLM from generation context and cached examples.
//

import type { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardMark, { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import StandardGuidance from '@tonylb/mtw-wml/ts/standardize/components/guidance'
import { renderTreeToString } from '@tonylb/mtw-base/ts/renderTree'
import type { EphemeraCacheMarkState, EphemeraCacheDynamoItem } from '../dataSource/renderCache/baseClasses'

export type BuildRoomDescriptionPromptInput = {
    roomId: string;
    generationContext: StandardForm;
    markState: EphemeraCacheMarkState;
    cachedExamples: EphemeraCacheDynamoItem[];
}

function editableToString(value: unknown): string {
    if (typeof value === 'string') return value
    return ''
}

function safeShortName(c: { shortName?: { toJSON?: () => unknown } }): string {
    const sn = c.shortName?.toJSON?.()
    return editableToString(sn)
}

function safeInstructions(c: { instructions?: { toJSON?: () => unknown } }): string {
    const i = c.instructions?.toJSON?.()
    return editableToString(i)
}

function exampleToPlainText(record: EphemeraCacheDynamoItem): string {
    const rc = record.renderedContent
    const state = record.markState.markValue.map((e) => `${e.mark}: ${e.value}`).join(', ')
    const displayName = rc.displayName ? renderTreeToString(rc.displayName) : ''
    const summary = rc.summary ? renderTreeToString(rc.summary) : ''
    const description = rc.description ? renderTreeToString(rc.description) : ''
    return [
        `State: ${state}`,
        displayName ? `DisplayName: ${displayName}` : '',
        summary ? `Summary: ${summary}` : '',
        `Description: ${description}`
    ].filter(Boolean).join('\n')
}

/**
 * Builds a single prompt string for the room-description LLM from parsed generation
 * context (Room, Lens, Marks, Guidance) and cached examples.
 */
export function buildRoomDescriptionPrompt(input: BuildRoomDescriptionPromptInput): string {
    const { generationContext, markState, cachedExamples } = input
    const components = generationContext.components

    let roomName = ''
    const marks: string[] = []
    const guidanceBlocks: string[] = []

    for (const c of components) {
        if (c instanceof StandardRoom) {
            roomName = safeShortName(c)
        } else if (c instanceof StandardMark) {
            const name = safeShortName(c)
            if (name) marks.push(name)
        } else if (c instanceof StandardLens) {
            // Lens itself is structural; Marks are listed separately
        } else if (c instanceof StandardGuidance) {
            const name = safeShortName(c)
            const instructions = safeInstructions(c)
            const parts = name ? [`${name}`] : []
            if (instructions) parts.push(instructions)
            if (parts.length) guidanceBlocks.push(parts.join('\n'))
        }
    }

    const proposedState = markState.markValue
        .map((e) => `${e.mark}: ${e.value}`)
        .join(', ')

    const examplesSection = cachedExamples.length > 0
        ? cachedExamples.map((rec, i) => `--- Example ${i + 1} ---\n${exampleToPlainText(rec)}`).join('\n\n')
        : '(No existing examples for this room and perspective.)'

    return [
        '## Room',
        roomName || '(Unnamed room)',
        '',
        '## Marks (world-state dimensions)',
        marks.length ? marks.join(', ') : '(None)',
        '',
        '## Guidance (style and constraints)',
        guidanceBlocks.length ? guidanceBlocks.join('\n\n') : '(None)',
        '',
        '## Proposed state (describe the room when these apply)',
        proposedState || '(No marks set)',
        '',
        '## Examples (existing descriptions for this room; match style and detail)',
        examplesSection,
        '',
        '## Instructions',
        'Respond with only a JSON object with exactly three string keys: displayName, summary, description. No markdown, no extra text. Each value is plain text for that field.'
    ].join('\n')
}
