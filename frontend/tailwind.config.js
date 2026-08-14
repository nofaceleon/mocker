/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        md: '768px', // 中等屏幕（平板横屏）
        lg: '1024px', // 大屏幕（笔记本）
        xl: '1280px', // 超大屏幕（桌面）
        '2xl': '1536px', // 最大屏幕
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        // 背景层（绑定 CSS 变量，支持深色模式）
        canvas: {
          DEFAULT: 'rgb(var(--canvas-bg) / <alpha-value>)',
          elevated: 'rgb(var(--canvas-elevated) / <alpha-value>)',
          subtle: 'rgb(var(--canvas-subtle) / <alpha-value>)',
          muted: 'rgb(var(--canvas-muted) / <alpha-value>)',
          deep: 'rgb(var(--canvas-deep) / <alpha-value>)',
          'deep-fg': 'rgb(var(--canvas-deep-foreground) / <alpha-value>)',
        },
        // 边框
        line: {
          DEFAULT: 'rgb(var(--line-default) / <alpha-value>)',
          subtle: 'rgb(var(--line-subtle) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
        // 文字
        ink: {
          DEFAULT: 'rgb(var(--ink-default) / <alpha-value>)',
          secondary: 'rgb(var(--ink-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--ink-tertiary) / <alpha-value>)',
          subtle: 'rgb(var(--ink-subtle) / <alpha-value>)',
          disabled: 'rgb(var(--ink-disabled) / <alpha-value>)',
          inverse: 'rgb(var(--ink-inverse) / <alpha-value>)',
        },
        // 状态色
        success: {
          DEFAULT: 'rgb(var(--success-fg) / <alpha-value>)',
          soft: 'rgb(var(--success-bg) / <alpha-value>)',
          border: 'rgb(var(--success-border) / <alpha-value>)',
          text: 'rgb(var(--success-text) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning-fg) / <alpha-value>)',
          soft: 'rgb(var(--warning-bg) / <alpha-value>)',
          border: 'rgb(var(--warning-border) / <alpha-value>)',
          text: 'rgb(var(--warning-text) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger-fg) / <alpha-value>)',
          soft: 'rgb(var(--danger-bg) / <alpha-value>)',
          border: 'rgb(var(--danger-border) / <alpha-value>)',
          text: 'rgb(var(--danger-text) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--info-fg) / <alpha-value>)',
          soft: 'rgb(var(--info-bg) / <alpha-value>)',
          border: 'rgb(var(--info-border) / <alpha-value>)',
          text: 'rgb(var(--info-text) / <alpha-value>)',
        },
        // 金色（高端金：奶油金 → 香槟金 → 琥珀金 → 尊贵金）
        gold: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        // HTTP 方法
        'm-get': { DEFAULT: 'rgb(var(--info-fg) / <alpha-value>)', bg: 'rgb(var(--info-bg) / <alpha-value>)' },
        'm-post': { DEFAULT: 'rgb(var(--success-fg) / <alpha-value>)', bg: 'rgb(var(--success-bg) / <alpha-value>)' },
        'm-put': { DEFAULT: 'rgb(var(--warning-fg) / <alpha-value>)', bg: 'rgb(var(--warning-bg) / <alpha-value>)' },
        'm-delete': { DEFAULT: 'rgb(var(--danger-fg) / <alpha-value>)', bg: 'rgb(var(--danger-bg) / <alpha-value>)' },
        'm-patch': { DEFAULT: 'rgb(124 58 237 / <alpha-value>)', bg: 'rgb(124 58 237 / 0.12 / <alpha-value>)' },
        'm-ws': { DEFAULT: 'rgb(15 118 110 / <alpha-value>)', bg: 'rgb(15 118 110 / 0.1 / <alpha-value>)' },
        'm-sse': { DEFAULT: 'rgb(190 24 93 / <alpha-value>)', bg: 'rgb(190 24 93 / 0.1 / <alpha-value>)' },
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        xs: 'var(--shadow-card)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: '0 16px 32px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04)',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        // 金色光带扫过
        'gold-shine': {
          '0%': { transform: 'translateX(-120%) skewX(-12deg)' },
          '60%': { transform: 'translateX(140%) skewX(-12deg)' },
          '100%': { transform: 'translateX(140%) skewX(-12deg)' },
        },
        // 金色辉光呼吸
        'gold-breath': {
          '0%, 100%': {
            opacity: '0.55',
            transform: 'scale(1)',
          },
          '50%': {
            opacity: '0.9',
            transform: 'scale(1.08)',
          },
        },
        // 金色星辉旋转（Sparkles 图标，扁平：去掉 drop-shadow）
        'gold-twinkle': {
          '0%, 100%': { transform: 'rotate(0deg) scale(1)' },
          '50%': { transform: 'rotate(15deg) scale(1.08)' },
        },
        // 推荐徽章的轻微呼吸（扁平：仅透明度，无 halo 阴影）
        'gold-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.75' },
        },
        // 金色箭头轻摆
        'gold-nudge': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(2px)' },
        },
      },
      animation: {
        'pulse-dot': 'pulse 2s infinite',
        'gold-shine': 'gold-shine 4.5s ease-in-out infinite',
        'gold-breath': 'gold-breath 3.6s ease-in-out infinite',
        'gold-twinkle': 'gold-twinkle 3s ease-in-out infinite',
        'gold-glow': 'gold-glow 2.4s ease-in-out infinite',
        'gold-nudge': 'gold-nudge 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
