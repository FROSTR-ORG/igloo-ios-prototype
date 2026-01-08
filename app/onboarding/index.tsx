import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Button } from '@/components/ui';

export default function OnboardingWelcome() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 px-6 pt-12 pb-8">
        {/* Header */}
        <View className="items-center mb-12">
          <View className="w-24 h-24 bg-frost-100 dark:bg-frost-900/30 rounded-full items-center justify-center mb-6">
            <FontAwesome name="snowflake-o" size={48} color="#0284c7" />
          </View>
          <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to Igloo
          </Text>
          <Text className="text-lg text-gray-600 dark:text-gray-400 text-center">
            FROST threshold signing for Nostr
          </Text>
        </View>

        {/* Description */}
        <View className="mb-12">
          <Text className="text-base text-gray-600 dark:text-gray-400 text-center leading-6">
            Igloo turns your device into a secure signing node for distributed key management.
            Import your share to start signing requests from your peers.
          </Text>
        </View>

        {/* Features */}
        <View className="gap-4 mb-auto">
          <FeatureItem
            icon="shield"
            title="Secure Storage"
            description="Your credentials are encrypted and stored securely on your device"
          />
          <FeatureItem
            icon="users"
            title="Peer Signing"
            description="Respond to signing requests from other key holders in your group"
          />
          <FeatureItem
            icon="lock"
            title="Threshold Security"
            description="No single device can sign alone - requires cooperation from peers"
          />
        </View>

        {/* Actions */}
        <View className="mt-8 gap-3">
          <Button
            title="Scan QR Code"
            size="lg"
            icon={<FontAwesome name="qrcode" size={20} color="white" />}
            onPress={() => router.push('/onboarding/scan')}
          />
          <Button
            title="Enter Manually"
            variant="secondary"
            size="lg"
            icon={<FontAwesome name="keyboard-o" size={20} color="#374151" />}
            onPress={() => router.push('/onboarding/manual')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  description: string;
}) {
  return (
    <View className="flex-row items-start">
      <View className="w-10 h-10 bg-frost-100 dark:bg-frost-900/30 rounded-lg items-center justify-center mr-4">
        <FontAwesome name={icon} size={18} color="#0284c7" />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-0.5">
          {title}
        </Text>
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          {description}
        </Text>
      </View>
    </View>
  );
}
