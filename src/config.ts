import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  outputDir: path.resolve(process.env.OUTPUT_DIR || './output'),
  defaults: {
    duration: 1,
    loop: true,
    size: 64,
    framerate: 30,
  },
};
