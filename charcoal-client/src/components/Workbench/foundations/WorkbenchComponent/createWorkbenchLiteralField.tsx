import React, { FunctionComponent, useCallback, useMemo } from 'react'

import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

import { TopLevelStandardLiteralEditor } from '../StandardLiteral'
import { literalPlainString } from '../workbenchMutations'
import { useWorkbenchComponent } from './useWorkbenchComponent'

export type WorkbenchLiteralFieldProps = {
    label?: string
    placeholder?: string
    size?: 'small' | 'medium'
    readonly?: boolean
}

export type WorkbenchLiteralFieldDescriptor<H extends StandardComponent> = {
    /** Narrows a StandardComponent to the kinds that host this literal field. */
    hostGuard: (component: StandardComponent) => component is H
    read: (host: H) => StandardLiteral | undefined
    write: (host: H, literal: StandardLiteral | undefined) => H
    label: string
    placeholder: string
}

/**
 * Builds a context-only literal field for component editor sessions (D4),
 * reading and writing only through the field's declared host interface
 * (`ShortNameHost`, `GlossHost`, ...) --- never through a `_payload` cast.
 * Mounting the field on a kind that doesn't host the field's capability is a
 * programming error: the descriptor's guard failing throws rather than
 * rendering nothing.
 */
export const createWorkbenchLiteralField = <H extends StandardComponent>(
    descriptor: WorkbenchLiteralFieldDescriptor<H>
): FunctionComponent<WorkbenchLiteralFieldProps> => {
    const WorkbenchLiteralField: FunctionComponent<WorkbenchLiteralFieldProps> = ({
        label = descriptor.label,
        placeholder = descriptor.placeholder,
        size = 'small',
        readonly: readonlyProp = false
    }) => {
        // Typed at H, not the session's default StandardComponent: this factory instance is
        // always mounted under a session whose committed component is (or should be) an H, per
        // the caller's own guard on WorkbenchComponentProvider. The hostGuard check below is the
        // runtime backstop for when that isn't true (nothing ties a field to its provider's
        // guard at compile time).
        const { working, setComponent, readonly: sessionReadonly, missing } =
            useWorkbenchComponent<H>()

        if (!missing && working !== undefined && !descriptor.hostGuard(working)) {
            throw new Error(
                'WorkbenchLiteralField mounted on a component that does not host this literal field'
            )
        }

        const displayLiteral = useMemo(
            () => (working ? descriptor.read(working) : undefined) ?? new StandardLiteral(''),
            [working]
        )

        const isReadonly = readonlyProp || sessionReadonly

        const handleChange = useCallback(
            (newLiteral: StandardLiteral) => {
                if (!working) {
                    return
                }
                const value = literalPlainString(newLiteral)
                setComponent(descriptor.write(working, value ? newLiteral : undefined))
            },
            [working, setComponent]
        )

        if (missing || !working) {
            return null
        }

        return (
            <TopLevelStandardLiteralEditor
                value={displayLiteral}
                onChange={handleChange}
                label={label}
                placeholder={placeholder}
                size={size}
                readonly={isReadonly}
                debounce={false}
            />
        )
    }

    return WorkbenchLiteralField
}

export default createWorkbenchLiteralField
