import type { CharacterSheet } from '../domain/types';

/** RED: installed cyberware with Humanity Loss reduces the ceiling by 2;
 * borgware reduces it by 4. Items with HL 0 do not reduce the ceiling.
 * Actual lost Humanity is tracked independently of this ceiling.
 */
export function cyberwareMaximumPenalty(character: CharacterSheet): number {
  return (character.cyberwareInstallations ?? []).reduce((total, install) =>
    total + (install.humanityLoss > 0 ? (install.slot === 'borg' ? 4 : 2) : 0), 0);
}
export function humanityCeiling(character: CharacterSheet): number {
  return Math.max(0, character.stats.emp * 10 - cyberwareMaximumPenalty(character));
}

/** Normalizes older V1.3 saves that deducted current Humanity but not its ceiling. */
export function migrateHumanityCeiling(character: CharacterSheet): CharacterSheet {
  const cap = humanityCeiling(character);
  const max = Math.min(character.humanity.max, cap);
  if (max === character.humanity.max && character.humanity.current <= max) return character;
  return { ...character, humanity: { max, current: Math.min(character.humanity.current, max) } };
}
