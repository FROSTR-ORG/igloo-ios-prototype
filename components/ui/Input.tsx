import { View, TextInput, Text, type TextInputProps } from 'react-native';
import { useState } from 'react';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({
  label,
  error,
  hint,
  className,
  multiline,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const hasError = !!error;

  return (
    <View className={className}>
      {label && (
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </Text>
      )}
      <TextInput
        className={`
          px-4 py-3 rounded-lg
          bg-gray-50 dark:bg-gray-900
          text-gray-900 dark:text-gray-100
          border-2
          ${hasError
            ? 'border-red-500'
            : isFocused
              ? 'border-frost-500'
              : 'border-gray-200 dark:border-gray-700'
          }
          ${multiline ? 'min-h-[100px] text-top' : ''}
        `}
        placeholderTextColor="#9ca3af"
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...props}
      />
      {error && (
        <Text className="text-sm text-red-500 mt-1">{error}</Text>
      )}
      {hint && !error && (
        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">{hint}</Text>
      )}
    </View>
  );
}
