import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, FlatList, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FileText,
  CheckSquare,
  Square,
  XCircle,
  AlertTriangle,
  Info,
  Bug,
  ChevronUp,
  ChevronDown,
  Trash2,
  Filter,
  Copy,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Card, Badge, Button, IconButton, GradientBackground, HelpTooltip } from '@/components/ui';
import { useLogStore } from '@/stores';
import type { LogEntry, LogLevel, LogCategory } from '@/types';

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const LOG_CATEGORIES: LogCategory[] = ['signing', 'relay', 'peer', 'echo', 'system'];

export default function LogsTab() {
  const entries = useLogStore((s) => s.entries);
  const filter = useLogStore((s) => s.filter);
  const autoScroll = useLogStore((s) => s.autoScroll);
  const clearLogs = useLogStore((s) => s.clearLogs);
  const setFilter = useLogStore((s) => s.setFilter);
  const setAutoScroll = useLogStore((s) => s.setAutoScroll);

  const flatListRef = useRef<FlatList>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Get filtered entries
  const filteredEntries = entries.filter(
    (entry) =>
      filter.levels.includes(entry.level) && filter.categories.includes(entry.category)
  );

  // Auto-scroll to top when new entries arrive
  useEffect(() => {
    if (autoScroll && filteredEntries.length > 0 && flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [filteredEntries.length, autoScroll]);

  const toggleLevel = useCallback(
    (level: LogLevel) => {
      const newLevels = filter.levels.includes(level)
        ? filter.levels.filter((l) => l !== level)
        : [...filter.levels, level];
      setFilter({ levels: newLevels.length > 0 ? newLevels : [level] }); // Keep at least one
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [filter.levels, setFilter]
  );

  const toggleCategory = useCallback(
    (category: LogCategory) => {
      const newCategories = filter.categories.includes(category)
        ? filter.categories.filter((c) => c !== category)
        : [...filter.categories, category];
      setFilter({ categories: newCategories.length > 0 ? newCategories : [category] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [filter.categories, setFilter]
  );

  const handleClearLogs = useCallback(() => {
    clearLogs();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [clearLogs]);

  const renderLogEntry: ListRenderItem<LogEntry> = useCallback(
    ({ item }) => (
      <LogEntryItem
        entry={item}
        expanded={expandedId === item.id}
        onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
      />
    ),
    [expandedId]
  );

  const keyExtractor = useCallback((item: LogEntry) => item.id, []);

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={[]}>
        {/* Filter Bar */}
        <View className="px-4 pt-2 pb-3 border-b border-gray-700/30 bg-gray-900/80">
          {/* Filter Header */}
          <View className="flex-row items-center gap-1 mb-2">
            <Filter size={12} color="#9ca3af" strokeWidth={2} />
            <Text className="text-xs font-medium text-gray-400">Filters</Text>
            <HelpTooltip
              title="Log Filters"
              content="Filter logs by severity level and category. Click a chip to toggle visibility. At least one filter must be active per row."
              size={12}
            />
          </View>
          {/* Level Filters */}
          <View className="flex-row items-center mb-2">
            <Text className="text-xs text-gray-400 mr-2 w-12">Level</Text>
            <View className="flex-row flex-wrap gap-1">
              {LOG_LEVELS.map((level) => (
                <FilterChip
                  key={level}
                  label={level}
                  active={filter.levels.includes(level)}
                  variant={getLevelVariant(level)}
                  onPress={() => toggleLevel(level)}
                />
              ))}
            </View>
          </View>

          {/* Category Filters */}
          <View className="flex-row items-center">
            <Text className="text-xs text-gray-400 mr-2 w-12">Type</Text>
            <View className="flex-row flex-wrap gap-1">
              {LOG_CATEGORIES.map((category) => (
                <FilterChip
                  key={category}
                  label={category}
                  active={filter.categories.includes(category)}
                  onPress={() => toggleCategory(category)}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Log List */}
        <FlatList
          ref={flatListRef}
          data={filteredEntries}
          renderItem={renderLogEntry}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={
            <View className="py-12 items-center">
              <FileText size={32} color="#9ca3af" strokeWidth={1.5} />
              <Text className="text-gray-400 mt-2">No log entries</Text>
              <Text className="text-sm text-gray-500 mt-1">
                Events will appear here as they occur
              </Text>
            </View>
          }
        />

        {/* Bottom Actions */}
        <View className="px-4 py-3 border-t border-gray-700/30 bg-gray-900/80 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Pressable
              onPress={() => setAutoScroll(!autoScroll)}
              className="flex-row items-center"
            >
              {autoScroll ? (
                <CheckSquare size={18} color="#60a5fa" strokeWidth={2} />
              ) : (
                <Square size={18} color="#9ca3af" strokeWidth={2} />
              )}
              <Text className="text-sm text-gray-400 ml-2">Auto-scroll</Text>
            </Pressable>
            <Text className="text-sm text-gray-400 ml-4">
              {filteredEntries.length} / {entries.length} entries
            </Text>
          </View>
          <IconButton
            icon={<Trash2 size={16} color="#9ca3af" strokeWidth={2} />}
            variant="ghost"
            size="md"
            disabled={entries.length === 0}
            onPress={handleClearLogs}
          />
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

function FilterChip({
  label,
  active,
  variant = 'default',
  onPress,
}: {
  label: string;
  active: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`
        px-2 py-1 rounded
        ${active
          ? variant === 'error'
            ? 'bg-red-900/30'
            : variant === 'warning'
              ? 'bg-yellow-900/30'
              : variant === 'info'
                ? 'bg-blue-900/30'
                : variant === 'success'
                  ? 'bg-green-900/30'
                  : 'bg-blue-900/30'
          : 'bg-gray-800'
        }
      `}
    >
      <Text
        className={`
          text-xs capitalize
          ${active
            ? variant === 'error'
              ? 'text-red-400'
              : variant === 'warning'
                ? 'text-yellow-400'
                : variant === 'info'
                  ? 'text-blue-400'
                  : variant === 'success'
                    ? 'text-green-400'
                    : 'text-blue-400'
            : 'text-gray-400'
          }
        `}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function LogEntryItem({
  entry,
  expanded,
  onToggle,
}: {
  entry: LogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasData = entry.data && Object.keys(entry.data).length > 0;

  const handleCopyData = useCallback(async () => {
    if (entry.data) {
      await Clipboard.setStringAsync(JSON.stringify(entry.data, null, 2));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [entry.data]);

  const renderLevelIcon = () => {
    const color = getLevelColor(entry.level);
    const props = { size: 14, color, strokeWidth: 2 };

    switch (entry.level) {
      case 'error':
        return <XCircle {...props} />;
      case 'warn':
        return <AlertTriangle {...props} />;
      case 'info':
        return <Info {...props} />;
      default:
        return <Bug {...props} />;
    }
  };

  // Get category badge variant based on category type
  const getCategoryVariant = () => {
    switch (entry.category) {
      case 'signing':
        return 'orange';
      case 'peer':
        return 'purple';
      case 'relay':
        return 'info';
      case 'echo':
        return 'success';
      case 'system':
      default:
        return 'default';
    }
  };

  return (
    <Pressable onPress={hasData ? onToggle : undefined}>
      <Card padding="sm">
        <View className="flex-row items-start">
          {/* Level Icon */}
          <View className="mr-2 mt-0.5">
            {renderLevelIcon()}
          </View>

          {/* Content */}
          <View className="flex-1">
            {/* Header Row */}
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center">
                <Badge label={entry.category} size="sm" variant={getCategoryVariant()} />
                {hasData && (
                  <View className="ml-1.5">
                    {expanded ? (
                      <ChevronUp size={10} color="#9ca3af" strokeWidth={2} />
                    ) : (
                      <ChevronDown size={10} color="#9ca3af" strokeWidth={2} />
                    )}
                  </View>
                )}
              </View>
              <Text className="text-xs text-gray-400">
                {formatTimestamp(entry.timestamp)}
              </Text>
            </View>

            {/* Message */}
            <Text className="text-sm text-gray-100">{entry.message}</Text>

            {/* Expanded Data */}
            {expanded && hasData && (
              <View className="mt-2 p-2 bg-gray-800 rounded">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs text-gray-500">Data</Text>
                  <Pressable onPress={handleCopyData} hitSlop={8}>
                    <Copy size={12} color="#9ca3af" strokeWidth={2} />
                  </Pressable>
                </View>
                <Text className="text-xs font-mono text-gray-400">
                  {JSON.stringify(entry.data, null, 2)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

// Returns Tailwind color hex values for RN components
function getLevelColor(level: LogLevel): string {
  switch (level) {
    case 'error':
      return '#ef4444'; // red-500
    case 'warn':
      return '#f59e0b'; // amber-500
    case 'info':
      return '#3b82f6'; // blue-500
    default:
      return '#9ca3af'; // gray-400
  }
}

function getLevelVariant(level: LogLevel): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (level) {
    case 'error':
      return 'error';
    case 'warn':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'default';
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
