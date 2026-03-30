import * as THREE from 'three'

export const SCENE_PRESET = {
  renderer: {
    exposure: 1.0,
    toneMapping: THREE.ACESFilmicToneMapping,
    outputColorSpace: THREE.SRGBColorSpace,
    shadowsEnabled: true,
    shadowMapType: THREE.PCFSoftShadowMap,
  },
  camera: {
    fieldOfView: 50,
    near: 0.1,
    far: 500,
    position: new THREE.Vector3(11, 8, 13),
    lookAt: new THREE.Vector3(0, 1.25, 0),
  },
  ambient: {
    color: 0xffffff,
    intensity: 0.65,
  },
  directional: {
    color: 0xffffff,
    intensity: 2.4,
    lightAngleDeg: 38,
    distance: 20,
    height: 14,
    castShadow: true,
    shadowMapSize: 2048,
    shadowBias: -0.0002,
  },
  pointLights: [
    {
      color: 0xfff1db,
      intensity: 35,
      distance: 28,
      decay: 2,
      position: new THREE.Vector3(6, 4.5, 6),
      castShadow: false,
    },
    {
      color: 0xfff6eb,
      intensity: 22,
      distance: 22,
      decay: 2,
      position: new THREE.Vector3(-6, 3.5, 5),
      castShadow: false,
    },
    {
      color: 0xf3f6ff,
      intensity: 18,
      distance: 20,
      decay: 2,
      position: new THREE.Vector3(5, 3.25, -6),
      castShadow: false,
    },
    {
      color: 0xffffff,
      intensity: 14,
      distance: 16,
      decay: 2,
      position: new THREE.Vector3(-4, 2.8, -5),
      castShadow: false,
    },
  ],
  materials: {
    floor: {
      color: 0xa98c72,
      roughness: 0.28,
      metalness: 0.0,
      envMapIntensity: 0.55,
    },
    wall: {
      color: 0xf2f1ec,
      roughness: 0.92,
      metalness: 0.0,
    },
  },
  reflection: {
    enabled: true,
    opacity: 0.18,
  },
} as const

export const SAMPLE_CAMERA_DIRECTION = SCENE_PRESET.camera.position.clone().sub(SCENE_PRESET.camera.lookAt).normalize()
