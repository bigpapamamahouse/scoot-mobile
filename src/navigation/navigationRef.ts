import { createNavigationContainerRef } from '@react-navigation/native';

// Create a navigation ref that can be used outside of React components
// This is in a separate file to avoid circular dependencies
export const navigationRef = createNavigationContainerRef();
