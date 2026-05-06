export function reorderItemArr<T>(opts: { array: T[]; srcIdx: number; targetIdx: number }) {
	const { array, srcIdx, targetIdx } = opts
	if (srcIdx === targetIdx) return { newArray: [...array] }
	const newArray = [...array]
	const [item] = newArray.splice(srcIdx, 1)
	const insertAt = srcIdx < targetIdx ? targetIdx - 1 : targetIdx
	newArray.splice(insertAt, 0, item)
	return { newArray }
}
