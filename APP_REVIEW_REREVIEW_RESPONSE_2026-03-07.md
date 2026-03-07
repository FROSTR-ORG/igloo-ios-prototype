# App Review Re-Review Response

Date: March 7, 2026
Submission ID: `88a8f0ea-7949-4c42-8f01-c285e69d3117`
App: `Igloo`
Version: `1.0 (8)`

## Resubmission Checklist

- Update the App Store Connect app name from `Igloo-ios` to `Igloo`.
- Resubmit using the build that includes the camera permission flow changes already committed on `staging`.
- Paste the response below into App Store Connect when replying to App Review.

## Paste-Ready Response

Hello App Review,

Thank you for the review and for outlining the issues clearly.

We addressed the items raised under Guidelines 5.2.5 and 5.1.1(iv), and we would also like to clarify our use of `UIBackgroundModes/audio` under Guideline 2.5.4.

For Guideline 5.2.5, we updated the app metadata to remove the use of `iOS` from the app name. The app name has been changed from `Igloo-ios` to `Igloo`.

For Guideline 5.1.1(iv), we revised the camera permission flow. The pre-permission screen now uses a neutral `Continue` button and proceeds directly to the system camera permission request. It no longer includes a back or dismiss option before the system permission prompt is shown. If camera access was previously denied and iOS can no longer present the system prompt, the app now directs the user to the Settings app instead.

For Guideline 2.5.4, we would like to clarify that our background audio is a user-facing feature called `Background Soundscape`. This is not hidden, silent, or solely technical audio. When the signer is running, the app plays an audible ambient soundscape that is surfaced directly in the UI. Users can select between different soundscapes, adjust the soundscape volume, and mute or unmute it while signer mode is active. The current soundscape is also exposed through iOS Now Playing / Control Center.

This feature is presented to users in the foreground in two places:

1. On the Signer screen, while the signer is running, a visible `Soundscape` control appears and can be tapped to mute or unmute the audio.
2. On the Settings screen, users can choose the soundscape and adjust `Soundscape Volume`.

The soundscape serves a user-facing purpose: it gives users audible confirmation that signer mode is active and provides an ambient audio experience while the signer remains available. This is an intentional part of the product experience for our target users; it is not a silent or hidden track used only to mask background execution. This interaction pattern is also familiar to users in the Nostr signing ecosystem, where audible signer-state feedback is an expected part of the experience.

If helpful, the feature can be reviewed with the following steps:

1. Launch the app and select `Demo Mode`.
2. Load the demo credentials and start the signer.
3. Confirm that the soundscape begins playing immediately when signer mode starts.
4. Observe the visible `Soundscape` control on the `Signer` screen while signer mode is active.
5. Open the `Settings` tab and review the `Soundscape` selection and `Soundscape Volume` controls.
6. Background the app and confirm that the selected soundscape continues as audible content, with Now Playing information visible in Control Center.

We respectfully request that the `audio` background mode remain enabled because the app provides continuous, user-facing audible content while signer mode is active.

Please let us know if any additional review notes, demo steps, or account context would be helpful.

Thank you.

## Internal Notes

- Camera permission fix is implemented in `app/onboarding/scan.tsx`.
- Naming cleanup in repo config is implemented in `app.json`, `package.json`, and `ios/Igloo/Info.plist`.
- The soundscape feature is visibly surfaced in:
  - `app/(tabs)/signer.tsx`
  - `app/(tabs)/settings.tsx`
  - `modules/background-audio/ios/BackgroundAudioModule.swift`

## Reviewer Walk-Through Notes

- Fastest path for review:
  - Launch app.
  - Select `Demo Mode`.
  - Load demo credentials.
  - Start signer.
  - Soundscape should begin immediately.
- `Signer` screen:
  - Shows `Background Soundscape` help text while the signer is running.
  - Shows a visible `Soundscape` badge/control for mute and unmute.
- `Settings` screen:
  - Shows `Soundscape` selection UI with multiple ambient audio options.
  - Shows `Soundscape Volume` controls.
- iOS integration:
  - Publishes the current soundscape to Now Playing / Control Center.
