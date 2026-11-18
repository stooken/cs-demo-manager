import { useRef } from 'react';
import type { GrenadeName } from 'csdm/common/types/counter-strike';
import { loadImageFromFilePath } from 'csdm/ui/shared/load-image-from-file-path';
import { getGrenadeImagePath } from 'csdm/ui/shared/get-grenade-image-path';

export function useGetGrenadeImage() {
  const cache = useRef(new Map<string, HTMLImageElement>());
  return async (name: GrenadeName) => {
    const path = getGrenadeImagePath(name);
    const cached = cache.current.get(path);
    if (cached) return cached;
    const image = await loadImageFromFilePath(path);
    cache.current.set(path, image);
    return image;
  };
}
