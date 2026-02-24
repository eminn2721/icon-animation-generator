// --- Animation Types ---

export const PRESET_ANIMATIONS = [
  'bounce',
  'spin',
  'pulse',
  'shake',
  'fade-in',
  'draw',
  'slide-in',
  'morph',
] as const;

export type PresetAnimation = (typeof PRESET_ANIMATIONS)[number];

export interface AnimationInput {
  /** Use a preset type, OR provide a custom description, OR both (custom overrides details) */
  type?: PresetAnimation;
  custom?: string; // e.g. "rotate clockwise while fading out, then bounce back"
}

export interface GenerateRequest {
  keyword: string;
  animation: AnimationInput;
  options?: GenerateOptions;
}

export interface GenerateOptions {
  duration?: number;  // seconds, default 1
  loop?: boolean;     // default true
  size?: number;      // px, default 64
}

// --- Pipeline internal types ---

export interface MatchedIcon {
  name: string;
  svg: string;
  tags: string[];
}

export interface AnimationDefinition {
  description: string;
  layers: LottieLayerAnimation[];
}

export interface LottieLayerAnimation {
  targetSelector: string; // which SVG element(s) to animate
  properties: LottieAnimatedProperty[];
}

export interface LottieAnimatedProperty {
  property: 'position' | 'scale' | 'rotation' | 'opacity' | 'path' | 'strokeDashoffset';
  keyframes: LottieKeyframe[];
}

export interface LottieKeyframe {
  time: number;       // 0-1 normalized
  value: number | number[];
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

// --- Lottie JSON spec (minimal subset) ---

export interface LottieJSON {
  v: string;          // version
  fr: number;         // framerate
  ip: number;         // in point
  op: number;         // out point
  w: number;          // width
  h: number;          // height
  nm: string;         // name
  layers: LottieLayer[];
  assets?: LottieAsset[];
}

export interface LottieLayer {
  ty: number;         // layer type (4 = shape)
  nm: string;
  ind: number;
  ip: number;
  op: number;
  st: number;
  ks: LottieTransform;
  shapes?: any[];
}

export interface LottieTransform {
  o?: LottieValue;    // opacity
  r?: LottieValue;    // rotation
  p?: LottieMultiValue; // position
  a?: LottieMultiValue; // anchor
  s?: LottieMultiValue; // scale
}

export interface LottieValue {
  a: 0 | 1;           // 0 = static, 1 = animated
  k: number | LottieKeyframeSpec[];
}

export interface LottieMultiValue {
  a: 0 | 1;
  k: number[] | LottieKeyframeSpec[];
}

export interface LottieKeyframeSpec {
  t: number;           // time (frame)
  s: number[];         // start value
  e?: number[];        // end value
  i?: { x: number[]; y: number[] };  // in tangent
  o?: { x: number[]; y: number[] };  // out tangent
}

export interface LottieAsset {
  id: string;
  [key: string]: any;
}

// --- API Response ---

export interface GenerateResponse {
  success: boolean;
  icon: string;
  animationType: string;
  file: string;
  lottie: LottieJSON;
  error?: string;
}
