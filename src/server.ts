import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { matchIcon } from './pipeline/icon-matcher';
import { generateAnimation, getAvailableAnimations } from './pipeline/animation-gen';
import { generateLocal } from './pipeline/local-gen';
import { validateAndFix, saveLottie } from './pipeline/lottie-builder';
import { GenerateRequest, PresetAnimation, PRESET_ANIMATIONS } from './types';

const app = express();

app.use(express.json());
app.use(express.static(path.resolve(__dirname, '../public')));

// --- POST /api/generate ---
app.post('/api/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Partial<GenerateRequest>;

    if (!body.keyword || typeof body.keyword !== 'string') {
      res.status(400).json({ success: false, error: 'keyword is required' });
      return;
    }

    const animation = body.animation || {};
    if (animation.type && !PRESET_ANIMATIONS.includes(animation.type as any)) {
      res.status(400).json({
        success: false,
        error: `Invalid animation type. Presets: ${PRESET_ANIMATIONS.join(', ')}. Or use "custom" field for free-form descriptions.`,
      });
      return;
    }

    if (!animation.type && !animation.custom) {
      res.status(400).json({
        success: false,
        error: 'Provide animation.type (preset) and/or animation.custom (free-form description)',
      });
      return;
    }

    const options = {
      duration: body.options?.duration || config.defaults.duration,
      loop: body.options?.loop ?? config.defaults.loop,
      size: body.options?.size || config.defaults.size,
    };

    // Step 1: Match icon
    const icon = matchIcon(body.keyword);
    if (!icon) {
      res.status(404).json({
        success: false,
        error: `No icon found for keyword "${body.keyword}". Try a different keyword.`,
      });
      return;
    }

    // Step 2: Generate animation
    let rawLottie: any;
    let animationDescription: string;
    const useCustom = !!animation.custom;

    if (useCustom) {
      // Custom animation requires Claude API
      if (!config.anthropicApiKey) {
        res.status(400).json({
          success: false,
          error: 'ANTHROPIC_API_KEY required for custom animations. Preset animations work without it.',
        });
        return;
      }
      const result = await generateAnimation(icon.svg, icon.name, animation, options);
      rawLottie = result.lottie;
      animationDescription = result.animationDescription;
    } else {
      // Preset animation — generated locally, no API key needed
      rawLottie = generateLocal(icon.svg, animation.type as PresetAnimation, options);
      animationDescription = animation.type!;
    }

    // Step 3: Validate and save
    const lottie = validateAndFix(rawLottie, options);
    const filename = saveLottie(lottie, body.keyword, animationDescription);

    res.json({
      success: true,
      icon: icon.name,
      animationType: animationDescription,
      file: filename,
      lottie,
    });
  } catch (err: any) {
    console.error('Generate error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

// --- GET /api/animation-types ---
app.get('/api/animation-types', (_req: Request, res: Response) => {
  res.json(getAvailableAnimations());
});

// --- GET /api/preview/:filename ---
app.get('/api/preview/:filename', (req: Request, res: Response): void => {
  const filename = Array.isArray(req.params.filename) ? req.params.filename[0]! : req.params.filename;
  const filepath = path.join(config.outputDir, filename);
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(filepath);
});

// --- Start ---
app.listen(config.port, '0.0.0.0', () => {
  console.log(`Icon Animation Generator running at http://localhost:${config.port}`);
  console.log(`Output directory: ${config.outputDir}`);
});

export default app;
