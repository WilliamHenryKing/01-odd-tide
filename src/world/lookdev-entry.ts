import { Vector3 } from "three";
import { buildLodge } from "./build/lodge";
import { buildObservatory } from "./build/observatory";
import { type Building, buildWeatherHouse } from "./build/weather-house";
import { mountLookdev } from "./lookdev";
import { createMaterials } from "./materials";
import { celestial } from "./render/sky-model";

// Look-dev stage: the three stays at real scale on the neutral ground, each with its own
// camera views, practicals with short-range shadows, and an optional ?open=1 reveal.
export async function start(host: HTMLElement) {
  const materials = await createMaterials();
  const params = new URLSearchParams(location.search);
  const open = Number(params.get("open") ?? "0");
  mountLookdev(host, [], ({ scene, rig }) => {
    const placed: { building: Building; at: Vector3; yaw: number; lift: number }[] = [
      { building: buildWeatherHouse(materials), at: new Vector3(8, 0, -6), yaw: -0.5, lift: 0.55 },
      { building: buildObservatory(materials), at: new Vector3(-1, 0, -13), yaw: 0.3, lift: 0.5 },
      { building: buildLodge(materials), at: new Vector3(13, 0, -16), yaw: -0.2, lift: 0.7 },
    ];
    const lights: ReturnType<typeof rig.registerPractical>[] = [];
    const glows: ReturnType<typeof rig.registerEmissive>[] = [];
    for (const { building, at, yaw, lift } of placed) {
      building.group.position.set(at.x, lift, at.z);
      building.group.rotation.y = yaw;
      building.setOpen(open);
      scene.add(building.group);
      for (const { light, candela } of building.lights) {
        light.castShadow = true;
        light.shadow.mapSize.set(512, 512);
        light.shadow.camera.near = 0.05;
        light.shadow.camera.far = 7;
        light.shadow.bias = -0.002;
        lights.push(rig.registerPractical(light, candela));
      }
      for (const { material, luminance } of building.emissive)
        glows.push(rig.registerEmissive(material, luminance));
    }
    const view = (at: Vector3, yaw: number, distance: number, height: number, side = 0.6) => ({
      position: [
        at.x + Math.sin(yaw + side) * distance,
        height,
        at.z + Math.cos(yaw + side) * distance,
      ] as [number, number, number],
      target: [at.x, 1.8, at.z] as [number, number, number],
    });
    const [house, observatory, lodge] = placed as [
      (typeof placed)[0],
      (typeof placed)[0],
      (typeof placed)[0],
    ];
    return {
      views: {
        house: { position: [15.5, 5.2, 3.5], target: [8, 1.8, -6] },
        "house-open": { position: [1.5, 7.5, 0.8], target: [8, 1.2, -6] },
        "house-front": { position: [8 - 0.479 * 13, 3.2, -6 + 0.878 * 13], target: [8, 2.2, -6] },
        "house-close": { position: [10.6, 1.7, -0.6], target: [8.6, 1.2, -3.6] },
        observatory: view(observatory.at, observatory.yaw, 11, 6.5),
        "observatory-close": view(observatory.at, observatory.yaw, 5.5, 3.2, 0.9),
        lodge: view(lodge.at, lodge.yaw, 13, 6.5, 0.3),
        "lodge-close": view(lodge.at, lodge.yaw, 6, 2.4, 0.1),
        all: { position: [4, 18, 18], target: [7, 0, -11] },
      },
      update(hour, time) {
        const on = celestial(hour).sun.elevation < 0.05 ? 1 : 0;
        for (const light of lights) light.on = on;
        for (const glow of glows) glow.on = 0.02 + on;
        for (const { building } of [house, observatory, lodge]) building.update?.(time);
      },
    };
  });
}
