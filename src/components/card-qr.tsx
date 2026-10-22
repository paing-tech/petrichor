import qrcode from "qrcode-generator";

/** The Petrichor "P" (from public/icon/Petrichor_Icon_RGB_Black.svg); it spans x 107–390, y 90–414. */
const P_PATH =
  "M296.098 90C347.959 90 390 132.042 390 183.902C390 235.763 347.958 277.805 296.098 277.805C268.324 277.805 243.369 265.746 226.177 246.58L189.58 383.165L189.474 383.136C185.535 396.268 172.841 407.234 156.306 410.149C134.252 414.038 113.718 402.135 110.443 383.563C107.169 364.992 122.392 346.783 144.446 342.895C148.495 342.181 152.493 342.001 156.342 342.295L203.587 165.976L203.89 166.057C212.225 122.73 250.339 90 296.098 90ZM296.098 149.756C277.239 149.756 261.951 165.044 261.951 183.902C261.951 202.761 277.239 218.049 296.098 218.049C314.956 218.049 330.244 202.761 330.244 183.902C330.244 165.044 314.956 149.756 296.098 149.756Z";
const P_BOX = { x: 107, y: 90, width: 283, height: 324 };

/** White space around the code, in modules (scanners need some; the card around it adds more). */
const MARGIN = 2;
/** The cleared square in the middle for the P, as a share of the code's width. */
const LOGO_SHARE = 0.24;
/** A dot's radius, in modules. */
const DOT = 0.42;

function makeQr(value: string) {
  const qr = qrcode(0, "Q");
  qr.addData(value);
  qr.make();
  return qr;
}

/** How much of the drawn code's width is white margin on each side, for lining things up with its dots. */
export function qrQuietShare(value: string) {
  return MARGIN / (makeQr(value).getModuleCount() + MARGIN * 2);
}

/**
 * A QR code to `value`, drawn in dots with rounded corner markers and the Petrichor P in the
 * middle, always black on a white tile so it scans on any card color. The P covers a few
 * modules, which the code's error correction (level Q, up to 25% unreadable) makes up for.
 */
export function CardQr({ value, className }: { value: string; className?: string }) {
  const qr = makeQr(value);
  const count = qr.getModuleCount();
  const size = count + MARGIN * 2;

  // The P's square, centred, with an odd number of modules so it sits on the grid evenly.
  const logo = Math.round(count * LOGO_SHARE) | 1;
  const logoStart = (count - logo) / 2;
  const inLogo = (row: number, col: number) =>
    row >= logoStart && row < logoStart + logo && col >= logoStart && col < logoStart + logo;
  // The three corner markers are drawn whole, below.
  const finders = [
    [0, 0],
    [0, count - 7],
    [count - 7, 0],
  ];
  const inFinder = (row: number, col: number) =>
    finders.some(([r, c]) => row >= r && row < r + 7 && col >= c && col < c + 7);

  const dots: string[] = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col) || inFinder(row, col) || inLogo(row, col)) continue;
      const x = col + MARGIN + 0.5;
      const y = row + MARGIN + 0.5;
      // A circle as a path: two arcs.
      dots.push(`M${x - DOT} ${y}a${DOT} ${DOT} 0 1 0 ${DOT * 2} 0a${DOT} ${DOT} 0 1 0 ${-DOT * 2} 0`);
    }
  }

  // The P fits the cleared square with a module of space around it.
  const pScale = (logo - 2) / Math.max(P_BOX.width, P_BOX.height);
  const pX = MARGIN + logoStart + (logo - P_BOX.width * pScale) / 2 - P_BOX.x * pScale;
  const pY = MARGIN + logoStart + (logo - P_BOX.height * pScale) / 2 - P_BOX.y * pScale;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label="QR code to this card's page">
      <rect width={size} height={size} rx={MARGIN} fill="#ffffff" />
      <g fill="#000000">
        <path d={dots.join("")} />
        {finders.map(([r, c]) => (
          <g key={`${r}-${c}`}>
            <rect
              x={c + MARGIN + 0.5}
              y={r + MARGIN + 0.5}
              width={6}
              height={6}
              rx={2}
              fill="none"
              stroke="#000000"
              strokeWidth={1}
            />
            <circle cx={c + MARGIN + 3.5} cy={r + MARGIN + 3.5} r={1.5} />
          </g>
        ))}
        <path d={P_PATH} transform={`translate(${pX} ${pY}) scale(${pScale})`} />
      </g>
    </svg>
  );
}
