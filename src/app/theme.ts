import {
  ActionIcon,
  AppShell,
  Badge,
  Button,
  Input,
  Modal,
  NativeSelect,
  NumberInput,
  ScrollArea,
  SegmentedControl,
  Select,
  Tabs,
  Textarea,
  TextInput,
  Tooltip,
  createTheme,
} from '@mantine/core'

const fontFamily = '"Inter Variable", Inter, "Segoe UI", system-ui, sans-serif'

export const theme = createTheme({
  fontFamily,
  primaryColor: 'blue',
  primaryShade: 6,
  defaultRadius: 'md',
  cursorType: 'pointer',
  white: '#ffffff',
  black: '#171c26',
  fontSizes: {
    xs: '12px',
    sm: '13px',
    md: '14px',
    lg: '16px',
    xl: '22px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  headings: {
    fontFamily,
    fontWeight: '650',
    sizes: {
      h1: { fontSize: '16px', lineHeight: '1.25', fontWeight: '650' },
      h2: { fontSize: '18px', lineHeight: '1.3', fontWeight: '650' },
      h3: { fontSize: '12px', lineHeight: '1.3', fontWeight: '700' },
      h4: { fontSize: '16px', lineHeight: '1.35', fontWeight: '600' },
    },
  },
  colors: {
    gray: [
      '#f5f6f8',
      '#eceef2',
      '#e1e4ea',
      '#cfd4dc',
      '#b3bac6',
      '#8b93a1',
      '#667084',
      '#475067',
      '#2d3544',
      '#171c26',
    ],
    blue: [
      '#f4f7fd',
      '#e7eefb',
      '#d4e2f8',
      '#b5cdf3',
      '#86adea',
      '#5b8fe0',
      '#3b73d4',
      '#2c5cb8',
      '#234a94',
      '#1c3b78',
    ],
    red: [
      '#fdf3f3',
      '#fbe6e6',
      '#f6d0d0',
      '#eeadad',
      '#e07d7d',
      '#d15b5b',
      '#c24141',
      '#a33333',
      '#862929',
      '#6e2121',
    ],
    yellow: [
      '#fff8ee',
      '#fef0d8',
      '#fce4b8',
      '#f8d08a',
      '#f0b44d',
      '#d9962a',
      '#b7791f',
      '#946014',
      '#7a4e10',
      '#5c3b0c',
    ],
    green: [
      '#f1f8f3',
      '#e2f2e7',
      '#c6e6d0',
      '#9ed4af',
      '#6dbb86',
      '#429a62',
      '#2f7d4e',
      '#246640',
      '#1c5133',
      '#163f28',
    ],
    orange: [
      '#f8f4ef',
      '#f0e8dc',
      '#e4d5c1',
      '#d4bda0',
      '#c4a07a',
      '#a67c52',
      '#8a6240',
      '#6f4d32',
      '#583d27',
      '#3f2c1c',
    ],
  },
  components: {
    AppShell: AppShell.extend({
      styles: {
        header: {
          background: 'var(--mantine-color-white)',
          borderBottom: '1px solid var(--mantine-color-gray-2)',
        },
        navbar: {
          background: 'var(--mantine-color-white)',
          borderRight: '1px solid var(--mantine-color-gray-2)',
        },
        aside: {
          background: 'var(--mantine-color-white)',
          borderLeft: '1px solid var(--mantine-color-gray-2)',
        },
        main: {
          background: 'var(--mantine-color-gray-0)',
        },
      },
    }),
    Button: Button.extend({
      defaultProps: { radius: 'md' },
      styles: {
        root: {
          fontWeight: 600,
          fontSize: '13px',
        },
      },
    }),
    ActionIcon: ActionIcon.extend({
      defaultProps: { radius: 'md', variant: 'default' },
      styles: {
        root: {
          color: 'var(--mantine-color-gray-7)',
          borderColor: 'var(--mantine-color-gray-3)',
          background: 'var(--mantine-color-white)',
        },
      },
    }),
    Input: Input.extend({
      defaultProps: { radius: 'md', size: 'sm' },
      styles: {
        input: {
          fontSize: '13px',
          fontWeight: 400,
          color: 'var(--mantine-color-gray-9)',
          borderColor: 'var(--mantine-color-gray-3)',
          background: 'var(--mantine-color-white)',
          fontVariantNumeric: 'tabular-nums',
        },
      },
    }),
    TextInput: TextInput.extend({
      defaultProps: { radius: 'md', size: 'sm' },
    }),
    Textarea: Textarea.extend({
      defaultProps: { radius: 'md', size: 'sm' },
    }),
    NativeSelect: NativeSelect.extend({
      defaultProps: { radius: 'md', size: 'sm' },
    }),
    Select: Select.extend({
      defaultProps: { radius: 'md', size: 'sm' },
    }),
    NumberInput: NumberInput.extend({
      defaultProps: { radius: 'md', size: 'sm' },
    }),
    Tabs: Tabs.extend({
      styles: {
        list: {
          gap: 4,
          borderColor: 'var(--mantine-color-gray-2)',
        },
        tab: {
          height: 36,
          paddingInline: 12,
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--mantine-color-gray-6)',
        },
      },
    }),
    Badge: Badge.extend({
      defaultProps: { radius: 'sm', variant: 'light' },
      styles: {
        root: {
          height: 22,
          paddingInline: 8,
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.01em',
          textTransform: 'none',
        },
      },
    }),
    SegmentedControl: SegmentedControl.extend({
      defaultProps: { radius: 'md' },
      styles: {
        root: {
          background: 'var(--mantine-color-gray-1)',
          padding: 4,
        },
        label: {
          fontSize: '12px',
          fontWeight: 600,
        },
      },
    }),
    Tooltip: Tooltip.extend({
      defaultProps: { openDelay: 400, withArrow: false },
      styles: {
        tooltip: {
          fontSize: '12px',
          fontWeight: 500,
          borderRadius: 6,
        },
      },
    }),
    Modal: Modal.extend({
      defaultProps: { radius: 'md', centered: true },
      styles: {
        title: {
          fontSize: '16px',
          fontWeight: 650,
        },
      },
    }),
    ScrollArea: ScrollArea.extend({
      styles: {
        scrollbar: {
          padding: 0,
        },
        thumb: {
          background: 'var(--mantine-color-gray-4)',
        },
      },
    }),
  },
})
