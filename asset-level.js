// Source: ./level-manifest.json (original Three.js Y-up meters, no rescaling).
// The single-file packer may replace this null with the original JSON object.
export const EMBEDDED_LEVEL_MANIFEST = null;

// Synchronous gameplay subset, verified against the original manifest.
export const ASSET_LEVEL = {
  floor_heights: [0, -5, -10],
  size_xz: [50, 30],
  recommended_player_radius: 0.62,
  character_height: 1.79,
  spawn: [0, 0, 11.5],
  exit: [0, -10, 13],
  treasures: [
    { id: 1, level: 1, type: 'dirt_mound', position: [0, 0.27, -2], visual_node: 'Treasure_1_Root', approach: [0, 0, 0.05], interactionRange: 2.3 },
    { id: 2, level: 2, type: 'wood_box', position: [0, -4.35, -9], visual_node: 'Treasure_2_Root', approach: [0, -5, -7.55], interactionRange: 1.9 },
    { id: 3, level: 3, type: 'wood_box', position: [0, -9.35, -6], visual_node: 'Treasure_3_Root', approach: [0, -10, -4.55], interactionRange: 1.9 },
  ],
  hazards: [
    { id: 1, type: 'static_spikes', level: 2, position: [13.75, -5, -11.25], trigger_center: [13.75, -4.45, -11.25], trigger_size: [2.2, 1.1, 2.2], root: 'Trap_1_Root' },
    { id: 2, type: 'static_spikes', level: 3, position: [-13.75, -10, 11.25], trigger_center: [-13.75, -9.45, 11.25], trigger_size: [2.2, 1.1, 2.2], root: 'Trap_2_Root' },
  ],
};

export async function loadAssetLevel() {
  if (EMBEDDED_LEVEL_MANIFEST) return EMBEDDED_LEVEL_MANIFEST;
  const response = await fetch(new URL('./level-manifest.json', document.baseURI));
  if (!response.ok) throw new Error(`关卡清单加载失败 (${response.status}): ./level-manifest.json`);
  return response.json();
}
