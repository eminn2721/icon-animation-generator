/**
 * SVG → Lottie shape converter for Lucide icons.
 * Produces valid Lottie shape groups compatible with lottie-web.
 *
 * Supports: M, m, L, l, H, h, V, v, C, c, S, s, Q, q, T, t, A, a, Z, z
 */

// ─── Arc-to-Bezier conversion ───────────────────────────────────────────────

function deg(rad: number): number { return (rad * 180) / Math.PI; }
function rad(deg: number): number { return (deg * Math.PI) / 180; }

/**
 * Convert an SVG arc to a series of cubic bezier curve segments.
 * Based on the W3C SVG spec arc implementation notes.
 */
function arcToBeziers(
  x1: number, y1: number,
  rx: number, ry: number,
  xAxisRotation: number,
  largeArcFlag: number,
  sweepFlag: number,
  x2: number, y2: number
): number[][] {
  // If endpoints are the same, no arc is drawn
  if (x1 === x2 && y1 === y2) return [];

  // If rx or ry is 0, treat as a straight line
  if (rx === 0 || ry === 0) return [];

  rx = Math.abs(rx);
  ry = Math.abs(ry);

  const phi = rad(xAxisRotation % 360);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: Compute (x1', y1') — transformed midpoint
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  // Step 2: Correct radii if too small
  let rxSq = rx * rx;
  let rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;

  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const lambdaSqrt = Math.sqrt(lambda);
    rx *= lambdaSqrt;
    ry *= lambdaSqrt;
    rxSq = rx * rx;
    rySq = ry * ry;
  }

  // Step 3: Compute center point (cx', cy')
  let sq = Math.max(0, (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq));
  sq = Math.sqrt(sq);
  if (largeArcFlag === sweepFlag) sq = -sq;

  const cxp = sq * (rx * y1p) / ry;
  const cyp = sq * -(ry * x1p) / rx;

  // Step 4: Compute center point (cx, cy) from (cx', cy')
  const cxUnrot = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cyUnrot = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // Step 5: Compute theta1 and dtheta
  function angle(ux: number, uy: number, vx: number, vy: number): number {
    const sign = (ux * vy - uy * vx < 0) ? -1 : 1;
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    let val = dot / len;
    if (val < -1) val = -1;
    if (val > 1) val = 1;
    return sign * Math.acos(val);
  }

  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dtheta = angle(
    (x1p - cxp) / rx, (y1p - cyp) / ry,
    (-x1p - cxp) / rx, (-y1p - cyp) / ry
  );

  if (sweepFlag === 0 && dtheta > 0) dtheta -= 2 * Math.PI;
  if (sweepFlag === 1 && dtheta < 0) dtheta += 2 * Math.PI;

  // Split arc into segments of max 90 degrees
  const segments = Math.max(1, Math.ceil(Math.abs(dtheta) / (Math.PI / 2)));
  const segAngle = dtheta / segments;

  const result: number[][] = [];

  for (let i = 0; i < segments; i++) {
    const t1 = theta1 + i * segAngle;
    const t2 = theta1 + (i + 1) * segAngle;

    // Convert arc segment to cubic bezier using the standard approximation
    const alpha = Math.sin(segAngle) * (Math.sqrt(4 + 3 * Math.tan(segAngle / 2) ** 2) - 1) / 3;

    const cos1 = Math.cos(t1), sin1 = Math.sin(t1);
    const cos2 = Math.cos(t2), sin2 = Math.sin(t2);

    // Points in the ellipse's local space
    const ep1x = rx * cos1, ep1y = ry * sin1;
    const ep2x = rx * cos2, ep2y = ry * sin2;

    // Derivatives
    const d1x = -rx * sin1, d1y = ry * cos1;
    const d2x = -rx * sin2, d2y = ry * cos2;

    // Control points in ellipse space
    const cp1x = ep1x + alpha * d1x;
    const cp1y = ep1y + alpha * d1y;
    const cp2x = ep2x - alpha * d2x;
    const cp2y = ep2y - alpha * d2y;

    // Transform back: rotate by phi, then translate by center
    function transform(px: number, py: number): [number, number] {
      return [
        cosPhi * px - sinPhi * py + cxUnrot,
        sinPhi * px + cosPhi * py + cyUnrot,
      ];
    }

    const [c1x, c1y] = transform(cp1x, cp1y);
    const [c2x, c2y] = transform(cp2x, cp2y);
    const [ex, ey] = transform(ep2x, ep2y);

    // Return: [cp1x, cp1y, cp2x, cp2y, endX, endY] — same format as cubic bezier
    result.push([c1x, c1y, c2x, c2y, ex, ey]);
  }

  return result;
}

// ─── Path parser ────────────────────────────────────────────────────────────

interface PathData {
  v: number[][];
  i: number[][];
  o: number[][];
  c: boolean;
}

/**
 * Parse an SVG path "d" attribute into Lottie bezier vertices.
 * Supports all common SVG path commands including arcs.
 */
function parsePathToVertices(d: string): PathData {
  const vertices: number[][] = [];
  const inTangents: number[][] = [];
  const outTangents: number[][] = [];

  let cx = 0, cy = 0;
  let startX = 0, startY = 0;
  let closed = false;
  // Track last control point for S/s and T/t commands
  let lastCp2x = 0, lastCp2y = 0;
  let lastCmd = '';

  const tokens = d.match(/[a-zA-Z]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || [];
  let idx = 0;

  function nextNum(): number {
    return parseFloat(tokens[idx++]!) || 0;
  }

  function hasMoreNums(): boolean {
    return idx < tokens.length && !/[a-zA-Z]/.test(tokens[idx]!);
  }

  function addVertex(x: number, y: number, ix = 0, iy = 0, ox = 0, oy = 0) {
    vertices.push([x, y]);
    inTangents.push([ix, iy]);
    outTangents.push([ox, oy]);
  }

  /** Add a cubic bezier segment from current point to endpoint.
   * c1x,c1y = first control point (absolute)
   * c2x,c2y = second control point (absolute)
   * ex,ey = endpoint (absolute) */
  function addCubic(c1x: number, c1y: number, c2x: number, c2y: number, ex: number, ey: number) {
    // Set out-tangent of the previous vertex
    if (outTangents.length > 0) {
      outTangents[outTangents.length - 1] = [c1x - cx, c1y - cy];
    }
    // In-tangent is relative to the endpoint
    addVertex(ex, ey, c2x - ex, c2y - ey, 0, 0);
    lastCp2x = c2x;
    lastCp2y = c2y;
    cx = ex;
    cy = ey;
  }

  while (idx < tokens.length) {
    const cmd = tokens[idx]!;
    if (!/[a-zA-Z]/.test(cmd)) {
      idx++;
      continue;
    }
    idx++;

    switch (cmd) {
      case 'M':
        cx = nextNum(); cy = nextNum();
        startX = cx; startY = cy;
        addVertex(cx, cy);
        lastCmd = 'M';
        // Implicit lineto after M
        while (hasMoreNums()) {
          cx = nextNum(); cy = nextNum();
          addVertex(cx, cy);
          lastCmd = 'L';
        }
        break;

      case 'm':
        cx += nextNum(); cy += nextNum();
        startX = cx; startY = cy;
        addVertex(cx, cy);
        lastCmd = 'm';
        while (hasMoreNums()) {
          cx += nextNum(); cy += nextNum();
          addVertex(cx, cy);
          lastCmd = 'l';
        }
        break;

      case 'L':
        while (hasMoreNums()) {
          cx = nextNum(); cy = nextNum();
          addVertex(cx, cy);
        }
        lastCmd = 'L';
        break;

      case 'l':
        while (hasMoreNums()) {
          cx += nextNum(); cy += nextNum();
          addVertex(cx, cy);
        }
        lastCmd = 'l';
        break;

      case 'H':
        while (hasMoreNums()) {
          cx = nextNum();
          addVertex(cx, cy);
        }
        lastCmd = 'H';
        break;

      case 'h':
        while (hasMoreNums()) {
          cx += nextNum();
          addVertex(cx, cy);
        }
        lastCmd = 'h';
        break;

      case 'V':
        while (hasMoreNums()) {
          cy = nextNum();
          addVertex(cx, cy);
        }
        lastCmd = 'V';
        break;

      case 'v':
        while (hasMoreNums()) {
          cy += nextNum();
          addVertex(cx, cy);
        }
        lastCmd = 'v';
        break;

      case 'C':
        while (hasMoreNums()) {
          const c1x = nextNum(), c1y = nextNum();
          const c2x = nextNum(), c2y = nextNum();
          const ex = nextNum(), ey = nextNum();
          addCubic(c1x, c1y, c2x, c2y, ex, ey);
        }
        lastCmd = 'C';
        break;

      case 'c':
        while (hasMoreNums()) {
          const dc1x = nextNum(), dc1y = nextNum();
          const dc2x = nextNum(), dc2y = nextNum();
          const dx = nextNum(), dy = nextNum();
          addCubic(cx + dc1x, cy + dc1y, cx + dc2x, cy + dc2y, cx + dx, cy + dy);
        }
        lastCmd = 'c';
        break;

      case 'S': {
        while (hasMoreNums()) {
          // Reflected control point from previous cubic
          let c1x: number, c1y: number;
          if ('CcSs'.includes(lastCmd)) {
            c1x = 2 * cx - lastCp2x;
            c1y = 2 * cy - lastCp2y;
          } else {
            c1x = cx;
            c1y = cy;
          }
          const c2x = nextNum(), c2y = nextNum();
          const ex = nextNum(), ey = nextNum();
          addCubic(c1x, c1y, c2x, c2y, ex, ey);
          lastCmd = 'S';
        }
        break;
      }

      case 's': {
        while (hasMoreNums()) {
          let c1x: number, c1y: number;
          if ('CcSs'.includes(lastCmd)) {
            c1x = 2 * cx - lastCp2x;
            c1y = 2 * cy - lastCp2y;
          } else {
            c1x = cx;
            c1y = cy;
          }
          const dc2x = nextNum(), dc2y = nextNum();
          const dx = nextNum(), dy = nextNum();
          addCubic(c1x, c1y, cx + dc2x, cy + dc2y, cx + dx, cy + dy);
          lastCmd = 's';
        }
        break;
      }

      case 'Q': {
        while (hasMoreNums()) {
          const qx = nextNum(), qy = nextNum();
          const ex = nextNum(), ey = nextNum();
          // Convert quadratic to cubic bezier
          const c1x = cx + (2 / 3) * (qx - cx);
          const c1y = cy + (2 / 3) * (qy - cy);
          const c2x = ex + (2 / 3) * (qx - ex);
          const c2y = ey + (2 / 3) * (qy - ey);
          addCubic(c1x, c1y, c2x, c2y, ex, ey);
          lastCp2x = qx; // Store quadratic CP for T command
          lastCp2y = qy;
          lastCmd = 'Q';
        }
        break;
      }

      case 'q': {
        while (hasMoreNums()) {
          const dqx = nextNum(), dqy = nextNum();
          const dx = nextNum(), dy = nextNum();
          const qx = cx + dqx, qy = cy + dqy;
          const ex = cx + dx, ey = cy + dy;
          const c1x = cx + (2 / 3) * (qx - cx);
          const c1y = cy + (2 / 3) * (qy - cy);
          const c2x = ex + (2 / 3) * (qx - ex);
          const c2y = ey + (2 / 3) * (qy - ey);
          addCubic(c1x, c1y, c2x, c2y, ex, ey);
          lastCp2x = qx;
          lastCp2y = qy;
          lastCmd = 'q';
        }
        break;
      }

      case 'T': {
        while (hasMoreNums()) {
          let qx: number, qy: number;
          if ('QqTt'.includes(lastCmd)) {
            qx = 2 * cx - lastCp2x;
            qy = 2 * cy - lastCp2y;
          } else {
            qx = cx;
            qy = cy;
          }
          const ex = nextNum(), ey = nextNum();
          const c1x = cx + (2 / 3) * (qx - cx);
          const c1y = cy + (2 / 3) * (qy - cy);
          const c2x = ex + (2 / 3) * (qx - ex);
          const c2y = ey + (2 / 3) * (qy - ey);
          addCubic(c1x, c1y, c2x, c2y, ex, ey);
          lastCp2x = qx;
          lastCp2y = qy;
          lastCmd = 'T';
        }
        break;
      }

      case 't': {
        while (hasMoreNums()) {
          let qx: number, qy: number;
          if ('QqTt'.includes(lastCmd)) {
            qx = 2 * cx - lastCp2x;
            qy = 2 * cy - lastCp2y;
          } else {
            qx = cx;
            qy = cy;
          }
          const dx = nextNum(), dy = nextNum();
          const ex = cx + dx, ey = cy + dy;
          const c1x = cx + (2 / 3) * (qx - cx);
          const c1y = cy + (2 / 3) * (qy - cy);
          const c2x = ex + (2 / 3) * (qx - ex);
          const c2y = ey + (2 / 3) * (qy - ey);
          addCubic(c1x, c1y, c2x, c2y, ex, ey);
          lastCp2x = qx;
          lastCp2y = qy;
          lastCmd = 't';
        }
        break;
      }

      case 'A':
      case 'a': {
        const isAbs = cmd === 'A';
        while (hasMoreNums()) {
          const rx = nextNum(), ry = nextNum();
          const xRot = nextNum();
          const largeArc = nextNum();
          const sweep = nextNum();
          const ex = isAbs ? nextNum() : cx + nextNum();
          const ey = isAbs ? nextNum() : cy + nextNum();

          const beziers = arcToBeziers(cx, cy, rx, ry, xRot, largeArc, sweep, ex, ey);
          for (const seg of beziers) {
            addCubic(seg[0], seg[1], seg[2], seg[3], seg[4], seg[5]);
          }
          // If arc returned no segments (degenerate), add endpoint as line
          if (beziers.length === 0 && (ex !== cx || ey !== cy)) {
            addVertex(ex, ey);
            cx = ex;
            cy = ey;
          }
        }
        lastCmd = cmd;
        break;
      }

      case 'Z':
      case 'z':
        closed = true;
        // If the last vertex doesn't match start, close tangent loop
        if (vertices.length > 0) {
          const last = vertices[vertices.length - 1];
          if (Math.abs(last[0] - startX) < 0.01 && Math.abs(last[1] - startY) < 0.01) {
            // Last vertex is already at start — remove duplicate
            vertices.pop();
            inTangents.pop();
            outTangents.pop();
          }
        }
        cx = startX;
        cy = startY;
        lastCmd = 'Z';
        break;
    }
  }

  return { v: vertices, i: inTangents, o: outTangents, c: closed };
}

// ─── Lottie shape helpers ───────────────────────────────────────────────────

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
      nm: 'Path',
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

// ─── Main export ────────────────────────────────────────────────────────────

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
    let pathD = '';
    for (let i = 0; i < pts.length; i += 2) {
      pathD += (i === 0 ? 'M' : 'L') + pts[i] + ' ' + pts[i + 1];
    }
    if (match[0]!.startsWith('<polygon')) pathD += 'Z';
    shapes.push(pathToGroup(pathD, index++));
  }

  return shapes;
}
