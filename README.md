# EdGo
A UNOFFICIAL react-native app for Ed Discussion.

<img src="/assets/images/icon.png" alt="EdGo Log" width="200" height="200">

<img src="/assets/images/darkMode_homepage.jpg" alt="Edgo Homepage Screenshot" width="150" height="200">
<img src="/assets/images/darkMode_course.jpg" alt="EdGo Course Screenshot" width="150" height="200">
<img src="/assets/images/darkMode_question.jpg" alt="EdGo Question Screenshot" width="150" height="200">
<img src="/assets/images/lightMode_homepage.jpg" alt="EdGo Homepage Screenshot" width="150" height="200">
<img src="/assets/images/lightMode_course.jpg" alt="EdGo Course Screenshot" width="150" height="200">
<img src="/assets/images/lightMode_question.jpg" alt="EdGo Question Screenshot" width="150" height="200">

## Running dev build

1. Install dependencies

   ```bash
   pnpm install
   ```

2. Start the app

   ```bash
   pnpm exec expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)

## Technical Details:
### Stack
- Framework: React Native + Expo
- DB + ORM: Drizzle + Expo-Sqlite
- Schemas + Data fetching: Effect-ts
- KV Cache: React-Native-MMKV
- Styling: Uniwind
