import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import GPTChat from '@/components/GPTChat';

export default function AIScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <GPTChat />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151718', // Dark background matching modern AI apps
  },
});