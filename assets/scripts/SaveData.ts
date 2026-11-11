export type Character = 'shooter' | 'warrior' | 'mage';
export interface SaveState {
    version: number;
    wins: Record<Character, boolean>;
    unlocked: Character[];
    current: Character;
    attempts: number;
    attemptUpdatedAt: number;
}
export const SAVE_VERSION = 2;
export const SAVE_KEY = 'goduck-save';
export const MAX_ATTEMPTS = 5;
export const REGEN_MS = 10 * 60_000;
export const AD_BONUS = 2;
const CHARACTERS: Character[] = ['shooter', 'warrior', 'mage'];
export function defaultSave(now = Date.now()): SaveState {
    return { version: SAVE_VERSION, wins: { shooter: false, warrior: false, mage: false }, unlocked: ['shooter'], current: 'shooter', attempts: MAX_ATTEMPTS, attemptUpdatedAt: now };
}
// A corrupt, empty or foreign-version save falls back to defaults instead of crashing the game.
// Legacy v1 saves (before the attempt system) migrate to v2 with a full attempt supply.
export function loadSave(raw: string | null | undefined, now = Date.now()): SaveState {
    if (!raw)
        return defaultSave(now);
    try {
        const data = JSON.parse(raw) as Partial<SaveState>;
        if (!data || (data.version !== SAVE_VERSION && data.version !== 1) || !Array.isArray(data.unlocked) || !data.wins)
            return defaultSave(now);
        const unlocked = CHARACTERS.filter(c => data.unlocked!.includes(c));
        const wins: Record<Character, boolean> = { shooter: false, warrior: false, mage: false };
        for (const c of CHARACTERS)
            wins[c] = data.wins![c] === true;
        // The current pick must stay inside the unlocked set; a tampered save cannot grant characters.
        const current = unlocked.includes(data.current as Character) ? data.current as Character : 'shooter';
        const attempts = data.version === SAVE_VERSION && typeof data.attempts === 'number' && data.attempts >= 0 && Number.isFinite(data.attempts)
            ? Math.floor(data.attempts) : MAX_ATTEMPTS;
        const attemptUpdatedAt = data.version === SAVE_VERSION && typeof data.attemptUpdatedAt === 'number' && data.attemptUpdatedAt >= 0 && Number.isFinite(data.attemptUpdatedAt)
            ? data.attemptUpdatedAt : now;
        return { version: SAVE_VERSION, wins, unlocked, current, attempts, attemptUpdatedAt };
    }
    catch {
        return defaultSave(now);
    }
}
// Atomic persistence: the whole payload goes out in exactly one write call.
export function persist(save: SaveState, write: (key: string, value: string) => void, key = SAVE_KEY): void {
    write(key, JSON.stringify(save));
}
export function recordStart(save: SaveState, character: Character): SaveState {
    if (!save.unlocked.includes(character) || save.current === character)
        return save;
    return { ...save, current: character };
}
// Wins are only recorded once per character; losses change nothing; unlocks follow the fixed chain.
export function recordResult(save: SaveState, character: Character, won: boolean): { save: SaveState; unlocked: Character[] } {
    if (!won || save.wins[character])
        return { save, unlocked: [] };
    const next: SaveState = { ...save, wins: { ...save.wins, [character]: true }, unlocked: save.unlocked.slice() };
    const added: Character[] = [];
    const unlock = (c: Character) => {
        if (!next.unlocked.includes(c)) {
            next.unlocked.push(c);
            added.push(c);
        }
    };
    if (character === 'shooter')
        unlock('warrior');
    else if (character === 'warrior')
        unlock('mage');
    return { save: next, unlocked: added };
}
// The duck to rescue after a win: the first locked character along the fixed unlock chain, null when all are free.
export function nextUnlockTarget(save: SaveState): Character | null {
    for (const c of ['warrior', 'mage'] as Character[])
        if (!save.unlocked.includes(c))
            return c;
    return null;
}
// Offline-friendly regen: whole REGEN_MS periods since attemptUpdatedAt restore one attempt each.
// The remainder is preserved so partial progress is never lost; a full supply just rolls the clock to now.
export function regenAttempts(save: SaveState, now: number): SaveState {
    let { attempts, attemptUpdatedAt } = save;
    if (attempts >= MAX_ATTEMPTS)
        return { ...save, attempts: MAX_ATTEMPTS, attemptUpdatedAt: now };
    while (attempts < MAX_ATTEMPTS && now - attemptUpdatedAt >= REGEN_MS) {
        attempts++;
        attemptUpdatedAt += REGEN_MS;
    }
    // Reaching the cap mid-regen consumes every remaining period, matching the full-at-entry branch.
    if (attempts >= MAX_ATTEMPTS)
        attemptUpdatedAt = now;
    return { ...save, attempts, attemptUpdatedAt };
}
// One run costs exactly one attempt; a save with none left refuses instead of going negative.
export function spendAttempt(save: SaveState, now: number): { ok: boolean; save: SaveState } {
    const regen = regenAttempts(save, now);
    if (regen.attempts <= 0)
        return { ok: false, save: regen };
    return { ok: true, save: { ...regen, attempts: regen.attempts - 1 } };
}
// Placeholder ad reward: regen first, then add a flat bonus that may exceed the cap.
// The real ad SDK must validate network results server-side before calling this in the production build.
export function grantAdBonus(save: SaveState, now: number): SaveState {
    const regen = regenAttempts(save, now);
    return { ...regen, attempts: regen.attempts + AD_BONUS };
}
