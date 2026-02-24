/**
 * SVG path data → Lottie shape converter (minimal subset for Lucide icons)
 * Handles M, L, C, A, Z commands and <circle> elements.
 */

interface LottieShapeGroup {
  ty: 'gr';
  nm: string;
  it: any[];
}

interface Point {
  x: number;
  y: number;
}

/**
 * Parse an SVG path "d" attribute into Lottie shape vertices.
 */
function parsePathToVertices(d: string): { v: number[][]; i: number[][]; o: number[][]; c: boolean } {
  const vertices: number[][] = [];
  const inTangents: number[][] = [];
  const outTangents: number[][] = [];

  let cx = 0, cy = 0;
  let startX = 0, startY = 0;
  let closed = false;

  // Tokenize: split into commands + numbers
  const tokens = d.match(/[a-zA-Z]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || [];
  let idx = 0;

  function nextNum(): number {
    return parseFloat(tokens[idx++]!) || 0;
  }

  function addVertex(x: number, y: number, ix = 0, iy = 0, ox = 0, oy = 0) {
    vertices.push([x, y]);
    inTangents.push([ix, iy]);
    outTangents.push([ox, oy]);
  }

  while (idx < tokens.length) {
    const cmd = tokens[idx]!;
    if (/[a-zA-Z]/.test(cmd)) {
      idx++;

      switch (cmd) {
        case 'M':
          cx = nextNum(); cy = nextNum();
          startX = cx; startY = cy;
          addVertex(cx, cy);
          // Implicit lineto after M
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            cx = nextNum(); cy = nextNum();
            addVertex(cx, cy);
          }
          break;

        case 'm':
          cx += nextNum(); cy += nextNum();
          startX = cx; startY = cy;
          addVertex(cx, cy);
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            cx += nextNum(); cy += nextNum();
            addVertex(cx, cy);
          }
          break;

        case 'L':
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            cx = nextNum(); cy = nextNum();
            addVertex(cx, cy);
          }
          break;

        case 'l':
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            cx += nextNum(); cy += nextNum();
            addVertex(cx, cy);
          }
          break;

        case 'H':
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            cx = nextNum();
            addVertex(cx, cy);
          }
          break;

        case 'h':
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            cx += nextNum();
            addVertex(cx, cy);
          }
          break;

        case 'V':
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            cy = nextNum();
            addVertex(cx, cy);
          }
          break;

        case 'v':
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            cy += nextNum();
            addVertex(cx, cy);
          }
          break;

        case 'C':
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            const c1x = nextNum(), c1y = nextNum();
            const c2x = nextNum(), c2y = nextNum();
            const ex = nextNum(), ey = nextNum();
            // Set out-tangent on previous vertex
            if (outTangents.length > 0) {
              outTangents[outTangents.length - 1] = [c1x - cx, c1y - cy];
            }
            // Add end vertex with in-tangent
            addVertex(ex, ey, c2x - ex, c2y - ey, 0, 0);
            cx = ex; cy = ey;
          }
          break;

        case 'c':
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            const dc1x = nextNum(), dc1y = nextNum();
            const dc2x = nextNum(), dc2y = nextNum();
            const dx = nextNum(), dy = nextNum();
            if (outTangents.length > 0) {
              outTangents[outTangents.length - 1] = [dc1x, dc1y];
            }
            const ex = cx + dx, ey = cy + dy;
            addVertex(ex, ey, dc2x - dx, dc2y - dy, 0, 0);
            cx = ex; cy = ey;
          }
          break;

        case 'A':
        case 'a': {
          // Approximate arcs as lines (good enough for small arcs in icons)
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            nextNum(); // rx
            nextNum(); // ry
            nextNum(); // x-rotation
            nextNum(); // large-arc
            nextNum(); // sweep
            const ex = cmd === 'A' ? nextNum() : cx + nextNum();
            const ey = cmd === 'A' ? nextNum() : cy + nextNum();
            addVertex(ex, ey);
            cx = ex; cy = ey;
          }
          break;
        }

        case 'Z':
        case 'z':
          closed = true;
          cx = startX; cy = startY;
          break;
      }
    } else {
      idx++; // skip unexpected token
    }
  }

  return {
    v: vertices,
    i: inTangents,
    o: outTangents,
    c: closed,
  };
}

/**
 * Convert a <circle> element to Lottie ellipse shape.
 */
function circleToLottieShape(cx: number, cy: number, r: number, index: number): LottieShapeGroup {
  return {
    ty: 'gr',
    nm: `circle-${index}`,
    it: [
      {
        ty: 'el', // ellipse
        p: { a: 0, k: [cx, cy] },
        s: { a: 0, k: [r * 2, r * 2] },
      },
      {
        ty: 'st', // stroke
        c: { a: 0, k: [0, 0, 0, 1] },
        o: { a: 0, k: 100 },
        w: { a: 0, k: 2 },
        lc: 2, // round cap
        lj: 2, // round join
      },
      {
        ty: 'tr', // transform
        p: { a: 0, k: [0, 0] },
        a: { a: 0, k: [0, 0] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
      },
    ],
  };
}

/**
 * Convert a <path d="..."> to Lottie shape group.
 */
function pathToLottieShape(d: string, index: number): LottieShapeGroup {
  const verts = parsePathToVertices(d);
  return {
    ty: 'gr',
    nm: `path-${index}`,
    it: [
      {
        ty: 'sh', // shape/path
        ks: {
          a: 0,
          k: verts,
        },
      },
      {
        ty: 'st', // stroke
        c: { a: 0, k: [0, 0, 0, 1] },
        o: { a: 0, k: 100 },
        w: { a: 0, k: 2 },
        lc: 2,
        lj: 2,
      },
      {
        ty: 'tr', // transform
        p: { a: 0, k: [0, 0] },
        a: { a: 0, k: [0, 0] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
      },
    ],
  };
}

/**
 * Parse all shapes from an SVG string into Lottie shape groups.
 */
export function svgToLottieShapes(svg: string): LottieShapeGroup[] {
  const shapes: LottieShapeGroup[] = [];
  let index = 0;

  // Extract <path d="..."> elements
  const pathRegex = /<path\s[^>]*d="([^"]+)"[^>]*\/?>/g;
  let match;
  while ((match = pathRegex.exec(svg)) !== null) {
    shapes.push(pathToLottieShape(match[1]!, index++));
  }

  // Extract <circle cx="..." cy="..." r="..."> elements
  const circleRegex = /<circle\s[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*r="([^"]+)"[^>]*\/?>/g;
  while ((match = circleRegex.exec(svg)) !== null) {
    shapes.push(circleToLottieShape(
      parseFloat(match[1]!),
      parseFloat(match[2]!),
      parseFloat(match[3]!),
      index++
    ));
  }

  // Also try alternate attribute order for circle
  const circleRegex2 = /<circle\s[^>]*r="([^"]+)"[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*\/?>/g;
  while ((match = circleRegex2.exec(svg)) !== null) {
    shapes.push(circleToLottieShape(
      parseFloat(match[2]!),
      parseFloat(match[3]!),
      parseFloat(match[1]!),
      index++
    ));
  }

  // Extract <line x1 y1 x2 y2>
  const lineRegex = /<line\s[^>]*x1="([^"]+)"[^>]*y1="([^"]+)"[^>]*x2="([^"]+)"[^>]*y2="([^"]+)"[^>]*\/?>/g;
  while ((match = lineRegex.exec(svg)) !== null) {
    const d = `M${match[1]} ${match[2]}L${match[3]} ${match[4]}`;
    shapes.push(pathToLottieShape(d, index++));
  }

  // Extract <rect x y width height rx>
  const rectRegex = /<rect\s[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*width="([^"]+)"[^>]*height="([^"]+)"[^>]*\/?>/g;
  while ((match = rectRegex.exec(svg)) !== null) {
    const x = parseFloat(match[1]!), y = parseFloat(match[2]!);
    const w = parseFloat(match[3]!), h = parseFloat(match[4]!);
    shapes.push({
      ty: 'gr',
      nm: `rect-${index++}`,
      it: [
        {
          ty: 'rc',
          p: { a: 0, k: [x + w / 2, y + h / 2] },
          s: { a: 0, k: [w, h] },
          r: { a: 0, k: 0 },
        },
        {
          ty: 'st',
          c: { a: 0, k: [0, 0, 0, 1] },
          o: { a: 0, k: 100 },
          w: { a: 0, k: 2 },
          lc: 2,
          lj: 2,
        },
        {
          ty: 'tr',
          p: { a: 0, k: [0, 0] },
          a: { a: 0, k: [0, 0] },
          s: { a: 0, k: [100, 100] },
          r: { a: 0, k: 0 },
          o: { a: 0, k: 100 },
        },
      ],
    });
  }

  // Extract <polyline points="..."> and <polygon points="...">
  const polyRegex = /<poly(?:line|gon)\s[^>]*points="([^"]+)"[^>]*\/?>/g;
  while ((match = polyRegex.exec(svg)) !== null) {
    const pts = match[1]!.trim().split(/[\s,]+/).map(Number);
    let d = '';
    for (let i = 0; i < pts.length; i += 2) {
      d += (i === 0 ? 'M' : 'L') + pts[i] + ' ' + pts[i + 1];
    }
    if (match[0]!.startsWith('<polygon')) d += 'Z';
    shapes.push(pathToLottieShape(d, index++));
  }

  return shapes;
}
