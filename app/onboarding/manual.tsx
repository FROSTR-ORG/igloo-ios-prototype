import { useState } from 'react';
import { View, Text, ScrollView, Alert, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Info, ClipboardPaste } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Button, Input, Card } from '@/components/ui';
import { useCredentials } from '@/hooks';

export default function OnboardingManual() {
  const [shareCredential, setShareCredential] = useState('');
  const [groupCredential, setGroupCredential] = useState('');
  const [shareError, setShareError] = useState<string>();
  const [groupError, setGroupError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const { validate, saveCredentials } = useCredentials();

  const validateInputs = () => {
    let hasError = false;

    // Reset errors
    setShareError(undefined);
    setGroupError(undefined);

    // Validate share
    if (!shareCredential.trim()) {
      setShareError('Share credential is required');
      hasError = true;
    } else if (!shareCredential.trim().startsWith('bfshare')) {
      setShareError('Must be a valid bfshare credential');
      hasError = true;
    }

    // Validate group
    if (!groupCredential.trim()) {
      setGroupError('Group credential is required');
      hasError = true;
    } else if (!groupCredential.trim().startsWith('bfgroup')) {
      setGroupError('Must be a valid bfgroup credential');
      hasError = true;
    }

    // Full validation
    if (!hasError) {
      const validation = validate(shareCredential.trim(), groupCredential.trim());
      if (!validation.shareValid) {
        setShareError(validation.shareError || 'Invalid share credential');
        hasError = true;
      }
      if (!validation.groupValid) {
        setGroupError(validation.groupError || 'Invalid group credential');
        hasError = true;
      }
    }

    return !hasError;
  };

  const handlePaste = async (field: 'share' | 'group') => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (field === 'share') {
          setShareCredential(text.trim());
          setShareError(undefined);
        } else {
          setGroupCredential(text.trim());
          setGroupError(undefined);
        }
      }
    } catch {
      // Clipboard access denied
    }
  };

  const handleSubmit = async () => {
    if (!validateInputs()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);

    try {
      const result = await saveCredentials(shareCredential.trim(), groupCredential.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (result.echoSent) {
        Alert.alert('Success', 'Credentials saved and echo sent to your group!', [
          { text: 'OK', onPress: () => router.replace('/(tabs)/signer') },
        ]);
      } else {
        Alert.alert(
          'Credentials Saved',
          'Your credentials were saved but echo could not be sent. You can still use the signer.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/signer') }]
        );
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = shareCredential.trim() && groupCredential.trim() && !isLoading;

  return (
    <SafeAreaView className="flex-1 bg-gray-950">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-blue-900/30">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center -ml-2"
          >
            <ArrowLeft size={18} color="#9ca3af" strokeWidth={2} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold text-gray-100 text-center mr-10">
            Enter Credentials
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4"
          keyboardShouldPersistTaps="handled"
        >
          {/* Info Card */}
          <Card variant="outlined" className="mb-6 bg-blue-900/20 border-blue-800">
            <View className="flex-row items-start">
              <Info size={18} color="#60a5fa" strokeWidth={2} />
              <Text className="flex-1 ml-3 text-sm text-blue-300">
                Enter your share and group credentials exactly as they were provided to you.
                These typically start with "bfshare" and "bfgroup".
              </Text>
            </View>
          </Card>

          {/* Share Input */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-sm font-medium text-gray-300">
                Share Credential
              </Text>
              <Pressable
                onPress={() => handlePaste('share')}
                className="flex-row items-center px-2 py-1"
              >
                <ClipboardPaste size={14} color="#60a5fa" strokeWidth={2} />
                <Text className="text-blue-400 text-sm ml-1">Paste</Text>
              </Pressable>
            </View>
            <Input
              placeholder="bfshare1..."
              value={shareCredential}
              onChangeText={(text) => {
                setShareCredential(text);
                setShareError(undefined);
              }}
              error={shareError}
              multiline
              numberOfLines={4}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Group Input */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-sm font-medium text-gray-300">
                Group Credential
              </Text>
              <Pressable
                onPress={() => handlePaste('group')}
                className="flex-row items-center px-2 py-1"
              >
                <ClipboardPaste size={14} color="#60a5fa" strokeWidth={2} />
                <Text className="text-blue-400 text-sm ml-1">Paste</Text>
              </Pressable>
            </View>
            <Input
              placeholder="bfgroup1..."
              value={groupCredential}
              onChangeText={(text) => {
                setGroupCredential(text);
                setGroupError(undefined);
              }}
              error={groupError}
              multiline
              numberOfLines={4}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Submit Button */}
          <Button
            title={isLoading ? 'Saving...' : 'Save Credentials'}
            size="lg"
            loading={isLoading}
            disabled={!canSubmit}
            onPress={handleSubmit}
          />

          {/* Scan Link */}
          <Pressable
            onPress={() => router.push('/onboarding/scan')}
            className="mt-4 py-2"
          >
            <Text className="text-blue-400 text-center">
              Prefer to scan? Use QR code
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
