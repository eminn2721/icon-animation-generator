/**
 * SVG → Lottie shape converter for Lucide icons.
 * Produces valid Lottie shape groups compatible with lottie-web.
 */

/**
 * Parse an SVG path "d" attribute into Lottie bezier vertices.
 */
function parsePathToVertices(d: string): { v: number[][]; i: number[][]; o: number[][]; c: boolean } {
  const vertices: number[][] = [];
  const inTangents: number[][] = [];
  const outTangents: number[][] = [];

  let cx = 0, cy = 0;
  let startX = 0, startY = 0;
  let closed = false;

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
            cx = nextNum(); cy = nextNum(); addVertex(cx, cy);
          }
          break;
        case 'l':
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            cx += nextNum(); cy += nextNum(); addVertex(cx, cy);
          }
          break;
        case 'H':
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            cx = nextNum(); addVertex(cx, cy);
          }
          break;
        case 'h':
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            cx += nextNum(); addVertex(cx, cy);
          }
          break;
        case 'V':
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            cy = nextNum(); addVertex(cx, cy);
          }
          break;
        case 'v':
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            cy += nextNum(); addVertex(cx, cy);
          }
          break;
        case 'C':
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            const c1x = nextNum(), c1y = nextNum();
            const c2x = nextNum(), c2y = nextNum();
            const ex = nextNum(), ey = nextNum();
            if (outTangents.length > 0) {
              outTangents[outTangents.length - 1] = [c1x - cx, c1y - cy];
            }
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
            const ex2 = cx + dx, ey2 = cy + dy;
            addVertex(ex2, ey2, dc2x - dx, dc2y - dy, 0, 0);
            cx = ex2; cy = ey2;
          }
          break;
        case 'A': case 'a': {
          while (idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!)) {
            nextNum(); nextNum(); nextNum(); nextNum(); nextNum();
            const ex = cmd === 'A' ? nextNum() : cx + nextNum();
            const ey = cmd === 'A' ? nextNum() : cy + nextNum();
            addVertex(ex, ey);
            cx = ex; cy = ey;
          }
          break;
        }
        case 'Z': case 'z':
          closed = true;
          cx = startX; cy = startY;
          break;
      }
    } else {
      idx++;
    }
  }

  return { v: vertices, i: inTangents, o: outTangents, c: closed };
}

/** Standard stroke style for Lucide icons */
function makeStroke(): any {
  return {
    ty: 'st',
    nm: 'Stroke',
    c: { a: 0, k: [0, 0, 0, 1] },
    o: { a: 0, k: 100 },
    w: { a: 0, k: 2 },
    lc: 2,
    lj: 2,
    ml: 4,
  };
}

/** Standard group transform (identity) */
function makeGroupTransform(): any {
  return {
    ty: 'tr',
    nm: 'Transform',
    p: { a: 0, k: [0, 0] },
    a: { a: 0, k: [0, 0] },
    s: { a: 0, k: [100, 100] },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  };
}

function makeGroup(name: string, items: any[]): any {
  const it = [...items, makeStroke(), makeGroupTransform()];
  return {
    ty: 'gr',
    nm: name,
    np: it.length,
    it,
  };
}

function pathToGroup(d: string, index: number): any {
  const verts = parsePathToVertices(d);
  return makeGroup(`Path ${index + 1}`, [
    {
      ty: 'sh',
      nm: `Path`,
      ks: { a: 0, k: verts },
    },
  ]);
}

function circleToGroup(cx: number, cy: number, r: number, index: number): any {
  return makeGroup(`Ellipse ${index + 1}`, [
    {
      ty: 'el',
      nm: 'Ellipse',
      p: { a: 0, k: [cx, cy] },
      s: { a: 0, k: [r * 2, r * 2] },
    },
  ]);
}

/**
 * Parse all shapes from an SVG string into Lottie shape groups.
 */
export function svgToLottieShapes(svg: string): any[] {
  const shapes: any[] = [];
  let index = 0;
  let match;

  // <path d="...">
  const pathRegex = /<path\s[^>]*d="([^"]+)"[^>]*\/?>/g;
  while ((match = pathRegex.exec(svg)) !== null) {
    shapes.push(pathToGroup(match[1]!, index++));
  }

  // <circle cx cy r>
  const circleRegex = /<circle\s[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*r="([^"]+)"[^>]*\/?>/g;
  while ((match = circleRegex.exec(svg)) !== null) {
    shapes.push(circleToGroup(parseFloat(match[1]!), parseFloat(match[2]!), parseFloat(match[3]!), index++));
  }

  // <line x1 y1 x2 y2>
  const lineRegex = /<line\s[^>]*x1="([^"]+)"[^>]*y1="([^"]+)"[^>]*x2="([^"]+)"[^>]*y2="([^"]+)"[^>]*\/?>/g;
  while ((match = lineRegex.exec(svg)) !== null) {
    shapes.push(pathToGroup(`M${match[1]} ${match[2]}L${match[3]} ${match[4]}`, index++));
  }

  // <rect x y width height>
  const rectRegex = /<rect\s[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*width="([^"]+)"[^>]*height="([^"]+)"[^>]*\/?>/g;
  while ((match = rectRegex.exec(svg)) !== null) {
    const x = parseFloat(match[1]!), y = parseFloat(match[2]!);
    const w = parseFloat(match[3]!), h = parseFloat(match[4]!);
    shapes.push(makeGroup(`Rect ${index + 1}`, [
      {
        ty: 'rc',
        nm: 'Rect',
        p: { a: 0, k: [x + w / 2, y + h / 2] },
        s: { a: 0, k: [w, h] },
        r: { a: 0, k: 0 },
      },
    ]));
    index++;
  }

  // <polyline> / <polygon>
  const polyRegex = /<poly(?:line|gon)\s[^>]*points="([^"]+)"[^>]*\/?>/g;
  while ((match = polyRegex.exec(svg)) !== null) {
    const pts = match[1]!.trim().split(/[\s,]+/).map(Number);
    let d = '';
    for (let i = 0; i < pts.length; i += 2) {
      d += (i === 0 ? 'M' : 'L') + pts[i] + ' ' + pts[i + 1];
    }
    if (match[0]!.startsWith('<polygon')) d += 'Z';
    shapes.push(pathToGroup(d, index++));
  }

  return shapes;
}
