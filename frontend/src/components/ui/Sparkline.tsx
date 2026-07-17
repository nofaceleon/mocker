import { cn } from '@/lib/cn';

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number;
  className?: string;
  /** 显示最后 N 个点（默认全部） */
  tail?: number;
};

/**
 * 极简折线 sparkline，纯 SVG，无交互。
 * data 为 null/空时绘制占位横线。
 */
export function Sparkline({
  data,
  width = 140,
  height = 28,
  color = 'currentColor',
  fill,
  strokeWidth = 1.5,
  className,
  tail,
}: SparklineProps) {
  const points = tail && tail > 0 ? data.slice(-tail) : data;
  const safe = points && points.length > 0 ? points : null;
  const max = Math.max(1, ...(safe ?? [1]));
  const min = Math.min(0, ...(safe ?? [0]));
  const range = Math.max(1, max - min);

  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const coords = safe
    ? safe.map((v, i) => {
        const x = pad + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
        const y = pad + h - ((v - min) / range) * h;
        return [x, y] as const;
      })
    : [];

  const linePath = coords
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    coords.length > 1
      ? `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${(height - pad).toFixed(1)} L${coords[0][0].toFixed(1)},${(height - pad).toFixed(1)} Z`
      : '';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('flex-shrink-0', className)}
      aria-hidden
    >
      {!safe ? (
        <line
          x1={pad}
          y1={height / 2}
          x2={width - pad}
          y2={height / 2}
          stroke={color}
          strokeOpacity={0.15}
          strokeWidth={1}
        />
      ) : (
        <>
          {fill && areaPath && <path d={areaPath} fill={fill} />}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
