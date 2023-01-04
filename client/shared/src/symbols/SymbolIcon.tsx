import * as React from 'react'

import classNames from 'classnames'
import { upperFirst } from 'lodash'

import { Icon, Tooltip } from '@sourcegraph/wildcard'

import { SymbolKind } from '../graphql-operations'

import styles from './SymbolIcon.module.scss'

import { getSymbolIconPath } from './symbols.ts'

interface SymbolIconProps {
    kind: SymbolKind
    className?: string
}
function getSymbolIconClassName(kind: SymbolKind): string | undefined {
    return (styles as Record<string, string>)[`symbolIconKind${upperFirst(kind.toLowerCase())}`]
}

/**
 * Renders an Icon for a given symbol kind
 */
export const SymbolIcon: React.FunctionComponent<React.PropsWithChildren<SymbolIconProps>> = ({
    kind,
    className = '',
}) => (
    <Tooltip content={kind.toLowerCase()}>
        <Icon
            data-testid="symbol-icon"
            data-symbol-kind={kind.toLowerCase()}
            className={classNames(getSymbolIconClassName(kind), className)}
            svgPath={getSymbolIconPath(kind)}
            aria-label={`Symbol kind ${kind.toLowerCase()}`}
        />
    </Tooltip>
)
