import fs from 'fs';
import path from 'path';
import { MatchedIcon } from '../types';

const LUCIDE_ICONS_DIR = path.resolve(__dirname, '../../node_modules/lucide-static/icons');
const LUCIDE_TAGS_PATH = path.resolve(__dirname, '../../node_modules/lucide-static/tags.json');

let tagsCache: Record<string, string[]> | null = null;
let iconNamesCache: string[] | null = null;

function loadTags(): Record<string, string[]> {
  if (!tagsCache) {
    tagsCache = JSON.parse(fs.readFileSync(LUCIDE_TAGS_PATH, 'utf-8'));
  }
  return tagsCache!;
}

function loadIconNames(): string[] {
  if (!iconNamesCache) {
    iconNamesCache = fs.readdirSync(LUCIDE_ICONS_DIR)
      .filter(f => f.endsWith('.svg'))
      .map(f => f.replace('.svg', ''));
  }
  return iconNamesCache!;
}

function readIconSvg(iconName: string): string {
  return fs.readFileSync(path.join(LUCIDE_ICONS_DIR, `${iconName}.svg`), 'utf-8');
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Match a keyword to a Lucide icon.
 * Strategy: exact name match → tag match → fuzzy substring match on names+tags
 */
export function matchIcon(keyword: string): MatchedIcon | null {
  const tags = loadTags();
  const names = loadIconNames();
  const kw = normalize(keyword);

  // 1. Exact name match
  const exactName = names.find(n => normalize(n) === kw);
  if (exactName) {
    return { name: exactName, svg: readIconSvg(exactName), tags: tags[exactName] || [] };
  }

  // 2. Tag exact match — find icons where any tag matches keyword
  const tagMatches: { name: string; score: number }[] = [];
  for (const [iconName, iconTags] of Object.entries(tags)) {
    for (const tag of iconTags) {
      if (normalize(tag) === kw) {
        tagMatches.push({ name: iconName, score: 100 });
        break;
      }
    }
  }
  if (tagMatches.length > 0) {
    const best = tagMatches[0];
    return { name: best.name, svg: readIconSvg(best.name), tags: tags[best.name] || [] };
  }

  // 3. Fuzzy: keyword is substring of name or tag
  const fuzzyMatches: { name: string; score: number }[] = [];
  for (const name of names) {
    const normName = normalize(name);
    if (normName.includes(kw) || kw.includes(normName)) {
      fuzzyMatches.push({ name, score: 50 + (normName === kw ? 50 : 0) });
      continue;
    }
    const iconTags = tags[name] || [];
    for (const tag of iconTags) {
      const normTag = normalize(tag);
      if (normTag.includes(kw) || kw.includes(normTag)) {
        fuzzyMatches.push({ name, score: 30 });
        break;
      }
    }
  }

  if (fuzzyMatches.length > 0) {
    fuzzyMatches.sort((a, b) => b.score - a.score);
    const best = fuzzyMatches[0];
    return { name: best.name, svg: readIconSvg(best.name), tags: tags[best.name] || [] };
  }

  return null;
}

/** Get all available icon names for reference */
export function getAllIconNames(): string[] {
  return loadIconNames();
}
