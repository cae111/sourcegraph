import React from 'react'

import { mdiInformationOutline } from '@mdi/js'

import { useQuery } from '@sourcegraph/http-client'
import { Icon, Tooltip } from '@sourcegraph/wildcard'

import { ChangesetStatisticsResult, ChangesetStatisticsVariables } from '../../../graphql-operations'
import { ChangesetStatusClosed, ChangesetStatusOpen } from '../detail/changesets/ChangesetStatusCell'

import { CHANGESET_STATISTICS } from './backend'

import styles from './BatchChangeStatsBar.module.scss'

interface BatchChangeStatsBarProps {
    className?: string
}

export const BatchChangeStatsBar: React.FunctionComponent<React.PropsWithChildren<BatchChangeStatsBarProps>> = () => {
    const { data } = useQuery<ChangesetStatisticsResult, ChangesetStatisticsVariables>(CHANGESET_STATISTICS, {})

    return (
        <div className={styles.statsBar}>
            <div className={styles.leftSide}>
                <div className="pr-4">
                    <span className="font-weight-bold">{data?.batchChanges.totalCount}</span>
                    <br />
                    <span>Batch Changes</span>
                </div>
                <div className="pr-4">
                    <span className="font-weight-bold">{data?.merged.totalCount}</span>
                    <br />
                    <span>Merged</span>
                </div>
                <div className="pr-4">
                    <span className="font-weight-bold">{data ? (data?.merged.totalCount * 15) / 60 : '--'}</span>
                    <br />
                    <span>
                        Hours Saved
                        <Tooltip content="Based on multiplier per changeset defined by site admin">
                            <Icon aria-label="More info" svgPath={mdiInformationOutline} className="ml-1" />
                        </Tooltip>
                    </span>
                </div>
            </div>
            <div className={styles.rightSide}>
                <div className="pr-4 text-center">
                    <ChangesetStatusOpen label="" />
                    <span className="font-weight-bold">{data?.opened.totalCount}</span> <span>Open</span>
                </div>
                <div className="text-center">
                    <ChangesetStatusClosed label="" />
                    <span className="font-weight-bold">{data?.closed.totalCount}</span> <span>Closed</span>
                </div>
            </div>
        </div>
    )
}