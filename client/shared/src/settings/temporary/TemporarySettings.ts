import { Optional } from 'utility-types'

import { BatchChangeState } from '../../graphql-operations'

import { DiffMode } from './diffMode'
import { RecentSearch } from './recentSearches'
import { SectionID, NoResultsSectionID } from './searchSidebar'
import { TourListState } from './tourState'

// Prior to this type we store in settings list of MultiSelectState
// we no longer use MultiSelect UI but for backward compatibility we still
// have to store and parse the old version of batch changes filters
export interface LegacyBatchChangesFilter {
    label: string
    value: BatchChangeState
}

/**
 * Schema for temporary settings.
 */
export interface TemporarySettingsSchema {
    'search.collapsedSidebarSections': { [key in SectionID]?: boolean }
    'search.hiddenNoResultsSections': NoResultsSectionID[]
    'search.sidebar.revisions.tab': number
    'search.sidebar.collapsed': boolean // Used only on non-mobile sizes and when coreWorkflowImprovements.enabled is set
    'search.notepad.enabled': boolean
    'search.notepad.ctaSeen': boolean
    'search.notebooks.gettingStartedTabSeen': boolean
    'insights.freeGaAccepted': boolean
    'insights.freeGaExpiredAccepted': boolean
    'insights.wasMainPageOpen': boolean
    'insights.lastVisitedDashboardId': string | null
    'npsSurvey.hasTemporarilyDismissed': boolean
    'npsSurvey.hasPermanentlyDismissed': boolean
    'user.lastDayActive': string | null
    'user.daysActiveCount': number
    'user.themePreference': string
    'signup.finishedWelcomeFlow': boolean
    'homepage.userInvites.tab': number
    'batches.defaultListFilters': LegacyBatchChangesFilter[]
    'batches.downloadSpecModalDismissed': boolean
    'codeintel.badge.used': boolean
    'codeintel.referencePanel.redesign.ctaDismissed': boolean
    'onboarding.quickStartTour': TourListState
    'characterKeyShortcuts.enabled': boolean
    'search.homepage.queryExamplesContent': {
        lastCachedTimestamp: string
        repositoryName: string
        filePath: string
        author: string
    }
    'search.results.collapseSmartSearch': boolean
    'search.input.recentSearches': RecentSearch[]
    'search.input.usedInlineHistory': boolean
    // TODO #41002: Remove this temporary setting.
    // This temporary setting is now turned on by default with no UI to toggle it off.
    'coreWorkflowImprovements.enabled_deprecated': boolean
    'batches.minSavedPerChangeset': number
    'search.notebooks.minSavedPerView': number
    'repo.commitPage.diffMode': DiffMode
}

/**
 * All temporary settings are possibly undefined. This is the actual schema that
 * should be used to force the consumer to check for undefined values.
 */
export type TemporarySettings = Optional<TemporarySettingsSchema>
