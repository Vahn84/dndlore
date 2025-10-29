import { useEffect, useMemo, useRef, useState } from 'react';
import debounce from 'lodash.debounce';

type SaveFn<T> = (data: T) => Promise<void>;

export function useAutoSave<T>(
	data: T | undefined,
	saveFn: SaveFn<T>,
	delay = 1200
) {
	if (!data) {
		return {
			isSaving: false,
			lastSavedAt: null,
			error: null,
		};
	}

	const [isSaving, setSaving] = useState(false);
	const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const latest = useRef<T>(data);
	latest.current = data;

	const debounced = useMemo(
		() =>
			debounce(async () => {
				try {
					setSaving(true);
					setError(null);
					await saveFn(latest.current);
					setLastSavedAt(Date.now());
				} catch (e: any) {
					setError(e?.message || 'Save failed');
				} finally {
					setSaving(false);
				}
			}, delay),
		[delay, saveFn]
	);

	// trigger su cambi di data
	useEffect(() => {
		debounced();
		return () => {
			debounced.cancel();
		};
	}, [data, debounced]);

	// cancel on unmount
	useEffect(() => () => debounced.cancel(), [debounced]);

	return { isSaving, lastSavedAt, error };
}
