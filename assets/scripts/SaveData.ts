export type Character = 'shooter' | 'warrior' | 'mage';
export interface SaveState {
    version: number;
    wins: Record<Character, boolean>;
    unlocked: Character[];
    current: Character;
}
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'goduck-save';
const CHARACTERS: Character[] = ['shooter', 'warrior', 'mage'];
export function defaultSave(): SaveState {
    return { version: SAVE_VERSION, wins: { shooter: false, warrior: false, mage: false }, unlocked: ['shooter'], current: 'shooter' };
}
// A corrupt, empty or foreign-version save falls back to defaults instead of crashing the game.
export function loadSave(raw: string | null | undefined): SaveState {
    if (!raw)
        return defaultSave();
    try {
        const data = JSON.parse(raw) as Partial<SaveState>;
        if (!data || data.version !== SAVE_VERSION || !Array.isArray(data.unlocked) || !data.wins)
            return defaultSave();
        const unlocked = CHARACTERS.filter(c => data.unlocked!.includes(c));
        const wins: Record<Character, boolean> = { shooter: false, warrior: false, mage: false };
        for (const c of CHARACTERS)
            wins[c] = data.wins![c] === true;
        // The current pick must stay inside the unlocked set; a tampered save cannot grant characters.
        const current = unlocked.includes(data.current as Character) ? data.current as Character : 'shooter';
        return { version: SAVE_VERSION, wins, unlocked, current };
    }
    catch {
        return defaultSave();
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
