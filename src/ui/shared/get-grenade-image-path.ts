import { GrenadeName } from 'csdm/common/types/counter-strike';

const images: Record<GrenadeName, string> = {
  [GrenadeName.Smoke]: 'smoke-detonate.png',
  [GrenadeName.Flashbang]: 'flashbang-detonate.png',
  [GrenadeName.HE]: 'he-detonate.png',
  [GrenadeName.Decoy]: 'decoy-detonate.png',
  [GrenadeName.Molotov]: 'molotov-detonate.png',
  [GrenadeName.Incendiary]: 'molotov-detonate.png',
};
export function getGrenadeImagePath(name: GrenadeName) {
  return `${window.csdm.IMAGES_FOLDER_PATH}/grenades/${images[name] ?? 'unknown-grenade.png'}`;
}
