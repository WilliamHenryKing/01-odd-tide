import {
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from "three";

// PBR texture sets as shipped in public/textures/<set>/: colour in sRGB, everything else linear.
// Sets follow Poly Haven's naming (diff / nor_gl / arm = AO·roughness·metalness).

export type PbrSet = { colour: Texture; normal: Texture; arm: Texture };

const loader = new TextureLoader();
const cache = new Map<string, Promise<Texture>>();

function load(url: string, colour: boolean, anisotropy: number): Promise<Texture> {
  const key = `${url}|${colour}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const promise = loader.loadAsync(url).then((texture) => {
    texture.colorSpace = colour ? SRGBColorSpace : NoColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = anisotropy;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.name = url.split("/").slice(-2).join("/");
    return texture;
  });
  cache.set(key, promise);
  return promise;
}

export async function loadPbrSet(
  name: string,
  resolution = "1k",
  anisotropy = 8,
  /** Rotate the maps 90° when the scan's grain runs along V (board UVs run grain along U). */
  grainAlongV = false,
): Promise<PbrSet> {
  const base = `/textures/${name}/${name}`;
  const [colour, normal, arm] = await Promise.all([
    load(`${base}_diff_${resolution}.jpg`, true, anisotropy),
    load(`${base}_nor_gl_${resolution}.jpg`, false, anisotropy),
    load(`${base}_arm_${resolution}.jpg`, false, anisotropy),
  ]);
  if (!grainAlongV) return { colour, normal, arm };
  const turn = (texture: Texture) => {
    const copy = texture.clone();
    copy.center.set(0.5, 0.5);
    copy.rotation = Math.PI / 2;
    copy.needsUpdate = true;
    return copy;
  };
  return { colour: turn(colour), normal: turn(normal), arm: turn(arm) };
}

export function disposeTextureCache() {
  for (const promise of cache.values()) void promise.then((texture) => texture.dispose());
  cache.clear();
}
