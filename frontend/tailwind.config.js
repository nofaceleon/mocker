/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
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
        // 背景层
        canvas: {
          DEFAULT: '#FAFAFA',
          elevated: '#FFFFFF',
          subtle: '#F4F4F5',
          deep: '#09090B',
        },
        // 边框
        line: {
          DEFAULT: '#E4E4E7',
          subtle: '#F4F4F5',
          strong: '#D4D4D8',
        },
        // 文字
        ink: {
          DEFAULT: '#09090B',
          secondary: '#52525B',
          tertiary: '#71717A',
          subtle: '#A1A1AA',
          disabled: '#D4D4D8',
          inverse: '#FAFAFA',
        },
        // 状态色
        success: { DEFAULT: '#15803D', soft: '#F0FDF4', border: '#DCFCE7', text: '#166534' },
        warning: { DEFAULT: '#A16207', soft: '#FEFCE8', border: '#FEF3C7', text: '#854D0E' },
        danger: { DEFAULT: '#B91C1C', soft: '#FEF2F2', border: '#FEE2E2' },
        info: { DEFAULT: '#0E7490', soft: '#ECFEFF', border: '#CFFAFE' },
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
        'm-get': { DEFAULT: '#0E7490', bg: '#ECFEFF' },
        'm-post': { DEFAULT: '#15803D', bg: '#F0FDF4' },
        'm-put': { DEFAULT: '#A16207', bg: '#FEFCE8' },
        'm-delete': { DEFAULT: '#B91C1C', bg: '#FEF2F2' },
        'm-patch': { DEFAULT: '#6D28D9', bg: '#F5F3FF' },
        'm-ws': { DEFAULT: '#0F766E', bg: '#F0FDFA' },
        'm-sse': { DEFAULT: '#BE185D', bg: '#FDF2F8' },
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        xs: '0 1px 1px rgba(0,0,0,0.03)',
        sm: '0 1px 2px rgba(0,0,0,0.04)',
        DEFAULT: '0 2px 4px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04)',
        md: '0 2px 4px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04)',
        lg: '0 8px 16px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)',
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
