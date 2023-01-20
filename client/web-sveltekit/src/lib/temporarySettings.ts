import { writable, type Writable, derived, type Readable } from 'svelte/store'
import { TemporarySettingsStorage } from '@sourcegraph/shared/src/settings/temporary/TemporarySettingsStorage'
import { migrateLocalStorageToTemporarySettings } from '@sourcegraph/shared/src/settings/temporary/migrateLocalStorageToTemporarySettings'
import { logger } from '@sourcegraph/common'
import type { TemporarySettings } from '@sourcegraph/shared/src/settings/temporary/TemporarySettings'
import { getStores } from './stores'
import type { LoadingData } from './utils'

const loggedOutUserStore = new TemporarySettingsStorage(null, false)

export function createTemporarySettingsStorage(storage = loggedOutUserStore): Writable<TemporarySettingsStorage> {
    const { subscribe, set } = writable(storage)

    function disposeAndSet(newStorage: TemporarySettingsStorage) {
        storage.dispose()
        // On first run, migrate the settings from the local storage to the temporary storage.
        migrateLocalStorageToTemporarySettings(newStorage).catch(logger.error)
        set((storage = newStorage))
    }

    return {
        set: disposeAndSet,
        update(callback) {
            disposeAndSet(callback(storage))
        },
        subscribe,
    }
}

type TemporarySettingsKey = keyof TemporarySettings
type TemporarySettingStatus<K extends TemporarySettingsKey> = LoadingData<TemporarySettings[K], any>

interface TemporarySettingStore<K extends TemporarySettingsKey> extends Readable<TemporarySettingStatus<K>> {
    setValue(value: TemporarySettings[K]): void
}

/**
 * Returns a store for the provided temporary setting.
 */
export function temporarySetting<K extends TemporarySettingsKey>(
    key: K,
    defaultValue?: TemporarySettings[K]
): TemporarySettingStore<K> {
    let storage: TemporarySettingsStorage | null = null

    const { subscribe } = derived(
        getStores().temporarySettingsStorage,
        ($storage, set) => {
            storage = $storage
            const subscription = $storage.get(key, defaultValue).subscribe({
                next: data => set({ loading: false, data, error: null }),
                error: error => set({ loading: false, data: null, error }),
            })
            return () => subscription.unsubscribe()
        },
        { loading: true } as TemporarySettingStatus<K>
    )

    // TODO: Do we need to sync a local copy like useTemporarySettings?

    return {
        subscribe,
        setValue(data) {
            storage?.set(key, data)
        },
    }
}
