import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import {
  AnimationInput,
  AnimationDefinition,
  GenerateOptions,
  PresetAnimation,
  PRESET_ANIMATIONS,
} from '../types';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const PRESET_DESCRIPTIONS: Record<PresetAnimation, string> = {
  bounce: 'The icon bounces up and down with a natural gravity feel. Starts at rest, moves up, comes back down with ease-in-out timing.',
  spin: 'The icon rotates 360 degrees clockwise smoothly and continuously.',
  pulse: 'The icon scales up slightly (1.0 → 1.2) then back down rhythmically, like a heartbeat.',
  shake: 'The icon shakes horizontally left-right rapidly, like a vibration or error indicator.',
  'fade-in': 'The icon fades in from fully transparent to fully opaque.',
  draw: 'The icon paths are drawn progressively using stroke-dashoffset animation, as if being drawn by hand from start to finish.',
  'slide-in': 'The icon slides in from the left side, moving from off-screen to its final centered position.',
  morph: 'The icon paths subtly morph/transform their shapes, creating a fluid organic movement.',
  shine: 'A bright diagonal light band sweeps across the icon from left to right, creating a shimmer/gleam effect.',
};

function buildPrompt(svg: string, animation: AnimationInput, options: GenerateOptions): string {
  const duration = options.duration || config.defaults.duration;
  const loop = options.loop ?? config.defaults.loop;
  const size = options.size || config.defaults.size;
  const framerate = config.defaults.framerate;
  const totalFrames = Math.round(duration * framerate);

  // Determine animation description
  let animDescription: string;
  if (animation.custom) {
    // Custom animation — user's free-form description, optionally augmented by preset base
    if (animation.type) {
      animDescription = `Base animation style: ${PRESET_DESCRIPTIONS[animation.type]}. Custom modifications: ${animation.custom}`;
    } else {
      animDescription = animation.custom;
    }
  } else if (animation.type) {
    animDescription = PRESET_DESCRIPTIONS[animation.type];
  } else {
    animDescription = 'A subtle, elegant entrance animation appropriate for this icon.';
  }

  return `You are a Lottie animation expert. Given an SVG icon and an animation description, produce a complete valid Lottie JSON.

## SVG Icon
\`\`\`svg
${svg}
\`\`\`

## Animation Description
${animDescription}

## Parameters
- Canvas size: ${size}x${size}px
- Duration: ${duration}s (${totalFrames} frames at ${framerate}fps)
- Loop: ${loop}
- Framerate: ${framerate}

## Requirements
1. Parse the SVG paths and convert them into Lottie shape layers
2. Apply the described animation using Lottie keyframes on transform properties (position, scale, rotation, opacity) and/or shape properties
3. The output must be a COMPLETE, VALID Lottie JSON that can be played by lottie-web or lottie-react-native
4. Use proper easing curves (cubic bezier) for natural motion
5. Icon should be centered in the canvas
6. Preserve the original icon proportions and stroke widths
7. Use stroke color #000000 (will be customizable later)

## Output
Return ONLY the raw Lottie JSON object. No markdown, no explanation, no code fences. Just the JSON.`;
}

export async function generateAnimation(
  svg: string,
  iconName: string,
  animation: AnimationInput,
  options: GenerateOptions
): Promise<{ lottie: any; animationDescription: string }> {
  const prompt = buildPrompt(svg, animation, options);

  const animLabel = animation.custom
    ? (animation.type ? `${animation.type}+custom` : 'custom')
    : (animation.type || 'default');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');

  // Extract JSON — handle possible markdown fences
  let jsonStr = text.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  const lottie = JSON.parse(jsonStr);

  return { lottie, animationDescription: animLabel };
}

export function getAvailableAnimations(): { presets: string[]; supportsCustom: boolean } {
  return {
    presets: [...PRESET_ANIMATIONS],
    supportsCustom: true,
  };
}
