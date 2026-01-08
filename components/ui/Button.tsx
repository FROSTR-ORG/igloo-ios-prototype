import {
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
  type TouchableOpacityProps,
} from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: 'bg-frost-600 active:bg-frost-700',
    text: 'text-white',
  },
  secondary: {
    container: 'bg-gray-200 dark:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600',
    text: 'text-gray-900 dark:text-gray-100',
  },
  danger: {
    container: 'bg-red-600 active:bg-red-700',
    text: 'text-white',
  },
  ghost: {
    container: 'bg-transparent active:bg-gray-100 dark:active:bg-gray-800',
    text: 'text-frost-600 dark:text-frost-400',
  },
};

const sizeStyles: Record<ButtonSize, { container: string; text: string }> = {
  sm: {
    container: 'px-3 py-1.5 rounded-md',
    text: 'text-sm',
  },
  md: {
    container: 'px-4 py-2.5 rounded-lg',
    text: 'text-base',
  },
  lg: {
    container: 'px-6 py-3.5 rounded-xl',
    text: 'text-lg',
  },
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <TouchableOpacity
      className={`
        flex-row items-center justify-center
        ${sizeStyle.container}
        ${variantStyle.container}
        ${isDisabled ? 'opacity-50' : ''}
        ${className || ''}
      `}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? 'white' : '#0284c7'}
          size="small"
        />
      ) : (
        <View className="flex-row items-center justify-center">
          {icon && <View className="items-center justify-center">{icon}</View>}
          <Text
            className={`
              font-semibold text-center
              ${sizeStyle.text}
              ${variantStyle.text}
              ${icon ? 'ml-2' : ''}
            `}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
