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
      },
      animation: {
        'pulse-dot': 'pulse 2s infinite',
      },
    },
  },
  plugins: [],
};
