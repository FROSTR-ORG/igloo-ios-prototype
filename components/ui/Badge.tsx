import { View, Text } from 'react-native';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  default: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-700 dark:text-gray-300',
    dot: 'bg-gray-500',
  },
  success: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    dot: 'bg-green-500',
  },
  warning: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    dot: 'bg-yellow-500',
  },
  error: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
  },
  info: {
    bg: 'bg-frost-100 dark:bg-frost-900/30',
    text: 'text-frost-700 dark:text-frost-400',
    dot: 'bg-frost-500',
  },
};

const sizeStyles: Record<BadgeSize, { container: string; text: string; dot: string }> = {
  sm: {
    container: 'px-2 py-0.5 rounded',
    text: 'text-xs',
    dot: 'w-1.5 h-1.5',
  },
  md: {
    container: 'px-2.5 py-1 rounded-md',
    text: 'text-sm',
    dot: 'w-2 h-2',
  },
};

export function Badge({ label, variant = 'default', size = 'md', dot = false, className }: BadgeProps) {
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <View
      className={`
        flex-row items-center
        ${sizeStyle.container}
        ${variantStyle.bg}
        ${className || ''}
      `}
    >
      {dot && (
        <View
          className={`
            rounded-full mr-1.5
            ${sizeStyle.dot}
            ${variantStyle.dot}
          `}
        />
      )}
      <Text
        className={`
          font-medium
          ${sizeStyle.text}
          ${variantStyle.text}
        `}
      >
        {label}
      </Text>
    </View>
  );
}
