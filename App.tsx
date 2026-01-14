import { StatusBar } from 'expo-status-bar';
import { StyleSheet, SafeAreaView, ScrollView, Text, View } from 'react-native';
import PRxWidget from './PRxWidget';

const WIDGET_ID = 'dd0ed535-3143-4209-876d-8779f0cde888';

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Clinical Trial Finder</Text>
          <Text style={styles.subtitle}>Find studies near you</Text>
        </View>
        <PRxWidget widgetId={WIDGET_ID} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
});
