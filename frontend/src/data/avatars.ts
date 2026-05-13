/**
 * Built-in avatar set.
 *
 * Source: Figma "ArtBloom UI Design" file (`1YkPdpdcSSvcBXPcp5nFxO`),
 * picker frame `680:1280` ("My account-2"). Order in this array matches
 * the **visual** left-to-right, top-to-bottom order of the Figma picker
 * grid (6 columns × 2 rows), not the Figma layer names. The Figma
 * "selected" tile sits at row 2, col 3 → that's index 8 here, which is
 * what `DEFAULT_AVATAR_INDEX` exposes for the user store.
 */
import a01 from '@/assets/images/avatars/avatar-01.png'
import a02 from '@/assets/images/avatars/avatar-02.png'
import a03 from '@/assets/images/avatars/avatar-03.png'
import a04 from '@/assets/images/avatars/avatar-04.png'
import a05 from '@/assets/images/avatars/avatar-05.png'
import a06 from '@/assets/images/avatars/avatar-06.png'
import a07 from '@/assets/images/avatars/avatar-07.png'
import a08 from '@/assets/images/avatars/avatar-08.png'
import a09 from '@/assets/images/avatars/avatar-09.png'
import a10 from '@/assets/images/avatars/avatar-10.png'
import a11 from '@/assets/images/avatars/avatar-11.png'
import a12 from '@/assets/images/avatars/avatar-12.png'

export interface Avatar {
    /** 0-based index — also the value persisted in localStorage. */
    id: number
    /** Vite-imported PNG URL. */
    src: string
    /** Stable label, used as alt-text fallback. */
    label: string
}

/**
 * Picker grid order (Figma):
 *   ┌────────────────────────────────────────┐
 *   │  6   5   4   12   11   10              │  row 1
 *   │  3   2   1*   9    8    7              │  row 2 (1* = default)
 *   └────────────────────────────────────────┘
 */
export const AVATARS: readonly Avatar[] = [
    { id: 0, src: a06, label: 'Avatar 6' },
    { id: 1, src: a05, label: 'Avatar 5' },
    { id: 2, src: a04, label: 'Avatar 4' },
    { id: 3, src: a12, label: 'Avatar 12' },
    { id: 4, src: a11, label: 'Avatar 11' },
    { id: 5, src: a10, label: 'Avatar 10' },
    { id: 6, src: a03, label: 'Avatar 3' },
    { id: 7, src: a02, label: 'Avatar 2' },
    { id: 8, src: a01, label: 'Avatar 1' }, // default — Figma "selected"
    { id: 9, src: a09, label: 'Avatar 9' },
    { id: 10, src: a08, label: 'Avatar 8' },
    { id: 11, src: a07, label: 'Avatar 7' },
] as const

/** Index of the avatar pre-selected on first load (matches Figma). */
export const DEFAULT_AVATAR_INDEX = 8

/**
 * Resolve an avatar by index, clamped to a valid value. Always returns
 * a non-null Avatar so callers can use `getAvatar(idx).src` safely.
 */
export function getAvatar(index: number): Avatar {
    const safe = Number.isFinite(index) && index >= 0 && index < AVATARS.length
        ? index
        : DEFAULT_AVATAR_INDEX
    return AVATARS[safe]
}
