import * as THREE from 'three'

/*
 * Putanja: src/engine3d/scenePreset.ts
 *
 * Centralno mesto za izgled scene. Ovde su sabrana podrazumevana podešavanja za:
 * - renderer (ekspozicija, ton, izlazne boje, tip senke)
 * - kameru
 * - ambijentalno, glavno i pomoćna svetla
 * - osnovne materijale poda i zida
 *
 * Kada želiš da slika bude toplija, hladnija, tamnija, sa jačim senkama
 * ili mekšim osvetljenjem, prvo se gleda ovaj fajl.
 */

export const SCENE_PRESET = {
  // Renderer određuje kako se završna slika računa i prikazuje na ekranu.
  renderer: {
    // Opšta svetlina scene nakon obrade slike. 1.0
    exposure: 0.8,
    // Način sabijanja jakih i slabih tonova da slika deluje prirodnije.
    toneMapping: THREE.ACESFilmicToneMapping,
    // Izlazni prostor boja za prikaz na ekranu. Bitno da drvo i boje frontova ne deluju isprano.
    outputColorSpace: THREE.SRGBColorSpace,
    // Globalni prekidač za senke.
    shadowsEnabled: true,
    // Tip senke: meka senka izgleda lepše, ali je skuplja za renderovanje.
    shadowMapType: THREE.PCFSoftShadowMap,
  },
  camera: {
    fieldOfView: 50,
    near: 0.1,
    far: 500,
    position: new THREE.Vector3(11, 8, 13),
    lookAt: new THREE.Vector3(0, 1.25, 0),
  },
  // Ambijentalno svetlo ravnomerno osvetljava celu scenu i omekšava duboke tamne zone. 0.65
  ambient: {
    color: 0xffffff,
    intensity: 0.9,
  },
  // Glavno svetlo scene. Ono najviše utiče na pravac senke, kontrast i čitljivost frontova. 2.4
  directional: {
    color: 0xffffff,
    intensity: 2.4,
    // Ugao iz kog glavno svetlo pada. Menja gde će ivice i senke biti najizraženije.
    lightAngleDeg: 38,
    distance: 20,
    height: 14,
    castShadow: true,
    // Veličina mape senke. Veći broj daje finiju ivicu senke, ali je skuplji.
    shadowMapSize: 2048,
    // Sitna korekcija da senka ne 'prilepi' sama sebe za površinu ili da ne lebdi.
    shadowBias: -0.0002,
  },
  // Pomoćna svetla pune tamne uglove i dodaju toplinu ili hladnoću završnoj slici.
  pointLights: [
    {
      //35,28,2
      color: 0xfff1db,
      intensity: 35,
      distance: 28,
      decay: 2,
      position: new THREE.Vector3(6, 4.5, 6),
      castShadow: false,
    },
    {
      //22,22,2
      color: 0xfff6eb,
      intensity: 22,
      distance: 22,
      decay: 2,
      position: new THREE.Vector3(-6, 3.5, 5),
      castShadow: false,
    },
    {
      //18,20,2
      color: 0xf3f6ff,
      intensity: 18,
      distance: 20,
      decay: 2,
      position: new THREE.Vector3(5, 3.25, -6),
      castShadow: false,
    },
    {
      //14,16,2
      color: 0xffffff,
      intensity: 14,
      distance: 16,
      decay: 2,
      position: new THREE.Vector3(-4, 2.8, -5),
      castShadow: false,
    },
  ],
  // Osnovni izgled poda i zidova. Ovo utiče na refleksiju i opšti utisak prostora.
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
  // Dodatna kontrola koliko prostor sme blago da reflektuje okolinu.
  reflection: {
    enabled: true,
    opacity: 0.18,
  },
} as const

export const SAMPLE_CAMERA_DIRECTION = SCENE_PRESET.camera.position.clone().sub(SCENE_PRESET.camera.lookAt).normalize()
