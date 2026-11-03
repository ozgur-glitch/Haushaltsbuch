import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
  Modal,
  Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Safe module imports with fallbacks to avoid crashes in Expo Go / Spck Editor
let FileSystem = null;
let DocumentPicker = null;

try {
  FileSystem = require('expo-file-system');
} catch (e) {
  console.log('expo-file-system not available');
}

try {
  DocumentPicker = require('expo-document-picker');
} catch (e) {
  console.log('expo-document-picker not available');
}

const STORAGE_KEY = '@haushaltsbuch_transactions_v1';
const THEME_KEY = '@haushaltsbuch_theme_v1';

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense'); // 'income' or 'expense'
  const [category, setCategory] = useState('Allgemein');
  const [darkMode, setDarkMode] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Load Data on Startup
  useEffect(() => {
    loadData();
    loadTheme();
  }, []);

  // Save transactions on change
  useEffect(() => {
    saveData(transactions);
  }, [transactions]);

  const loadData = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      if (jsonValue != null) {
        setTransactions(JSON.parse(jsonValue));
      }
    } catch (e) {
      Alert.alert('Fehler', 'Daten konnten nicht geladen werden.');
    }
  };

  const saveData = async (value) => {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
    } catch (e) {
      console.error('Speicherfehler:', e);
    }
  };

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_KEY);
      if (savedTheme !== null) {
        setDarkMode(JSON.parse(savedTheme));
      }
    } catch (e) {}
  };

  const toggleTheme = async () => {
    const nextMode = !darkMode;
    setDarkMode(nextMode);
    try {
      await AsyncStorage.setItem(THEME_KEY, JSON.stringify(nextMode));
    } catch (e) {}
  };

  const addTransaction = () => {
    if (!title.trim() || !amount.trim()) {
      Alert.alert('Hinweis', 'Bitte geben Sie einen Titel und einen Betrag ein.');
      return;
    }

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Hinweis', 'Bitte geben Sie einen gültigen Betrag ein.');
      return;
    }

    const newTransaction = {
      id: Date.now().toString(),
      title: title.trim(),
      amount: parsedAmount,
      type,
      category,
      date: new Date().toLocaleDateString('de-DE')
    };

    setTransactions([newTransaction, ...transactions]);
    setTitle('');
    setAmount('');
  };

  const deleteTransaction = (id) => {
    Alert.alert('Löschen', 'Möchten Sie diesen Eintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => setTransactions(transactions.filter(t => t.id !== id))
      }
    ]);
  };

  // Export JSON Backup
  const exportBackup = async () => {
    try {
      const dataString = JSON.stringify(transactions, null, 2);
      const fileName = `haushaltsbuch_backup_${Date.now()}.json`;

      if (Platform.OS === 'android' && FileSystem?.StorageAccessFramework) {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const uri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'application/json'
          );
          await FileSystem.writeAsStringAsync(uri, dataString, { encoding: FileSystem.EncodingType.UTF8 });
          Alert.alert('Erfolg', 'Backup wurde erfolgreich gespeichert!');
          return;
        }
      }

      if (FileSystem?.documentDirectory) {
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, dataString, { encoding: FileSystem.EncodingType.UTF8 });
        Alert.alert('Erfolg', `Backup gespeichert unter:\n${fileUri}`);
      } else {
        Alert.alert('Info', 'Dateisystem auf diesem Gerät/Umfeld nicht direkt verfügbar.');
      }
    } catch (e) {
      Alert.alert('Fehler', 'Export fehlgeschlagen: ' + e.message);
    }
  };

  // Import JSON Backup
  const importBackup = async () => {
    if (!DocumentPicker) {
      Alert.alert('Fehler', 'DocumentPicker ist in dieser Umgebung nicht verfügbar.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (result.canceled) return;

      const fileUri = result.assets ? result.assets[0].uri : result.uri;
      if (!fileUri || !FileSystem) return;

      const fileContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8
      });

      const parsedData = JSON.parse(fileContent);

      if (!Array.isArray(parsedData)) {
        throw new Error('Ungültiges Dateiformat.');
      }

      Alert.alert(
        'Wiederherstellung',
        'Möchten Sie alle vorhandenen Daten durch dieses Backup ersetzen?',
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Wiederherstellen',
            style: 'destructive',
            onPress: () => {
              setTransactions(parsedData);
              setSettingsVisible(false);
              Alert.alert('Erfolg', 'Daten wurden erfolgreich wiederhergestellt!');
            }
          }
        ]
      );
    } catch (e) {
      Alert.alert('Fehler', 'Import fehlgeschlagen: Ungültige Datei.');
    }
  };

  // Calculations
  const incomeTotal = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenseTotal = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = incomeTotal - expenseTotal;

  // Theme Colors
  const theme = {
    bg: darkMode ? '#0F172A' : '#F8FAFC',
    cardBg: darkMode ? '#1E293B' : '#FFFFFF',
    text: darkMode ? '#F8FAFC' : '#0F172A',
    subText: darkMode ? '#94A3B8' : '#64748B',
    accent: '#3B82F6',
    income: '#10B981',
    expense: '#EF4444',
    border: darkMode ? '#334155' : '#E2E8F0'
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Haushaltsbuch</Text>
        <TouchableOpacity
          style={[styles.settingsButton, { backgroundColor: theme.cardBg }]}
          onPress={() => setSettingsVisible(true)}
        >
          <Text style={{ color: theme.text, fontSize: 18 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Financial Overview Card */}
      <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <Text style={[styles.summaryLabel, { color: theme.subText }]}>Gesamtsaldo</Text>
        <Text style={[styles.balanceText, { color: balance >= 0 ? theme.income : theme.expense }]}>
          {balance.toFixed(2)} €
        </Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryItemLabel, { color: theme.subText }]}>Einnahmen</Text>
            <Text style={[styles.incomeText, { color: theme.income }]}>+{incomeTotal.toFixed(2)} €</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryItemLabel, { color: theme.subText }]}>Ausgaben</Text>
            <Text style={[styles.expenseText, { color: theme.expense }]}>-{expenseTotal.toFixed(2)} €</Text>
          </View>
        </View>
      </View>

      {/* Input Form */}
      <View style={[styles.formCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              type === 'expense' && { backgroundColor: theme.expense }
            ]}
            onPress={() => setType('expense')}
          >
            <Text style={[styles.typeButtonText, type === 'expense' && styles.activeTypeText]}>Ausgabe</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeButton,
              type === 'income' && { backgroundColor: theme.income }
            ]}
            onPress={() => setType('income')}
          >
            <Text style={[styles.typeButtonText, type === 'income' && styles.activeTypeText]}>Einnahme</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          placeholder="Beschreibung (z.B. Einkauf)"
          placeholderTextColor={theme.subText}
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          placeholder="Betrag in € (z.B. 12.50)"
          placeholderTextColor={theme.subText}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />

        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.accent }]} onPress={addTransaction}>
          <Text style={styles.addButtonText}>Eintrag Hinzufügen</Text>
        </TouchableOpacity>
      </View>

      {/* Transaction List */}
      <View style={styles.listContainer}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Verlauf</Text>
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onLongPress={() => deleteTransaction(item.id)}
              style={[styles.transItem, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
            >
              <View>
                <Text style={[styles.transTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.transDate, { color: theme.subText }]}>{item.date}</Text>
              </View>
              <Text
                style={[
                  styles.transAmount,
                  { color: item.type === 'income' ? theme.income : theme.expense }
                ]}
              >
                {item.type === 'income' ? '+' : '-'}{item.amount.toFixed(2)} €
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.subText }]}>Keine Buchungen vorhanden.</Text>
          }
        />
      </View>

      {/* Settings Modal */}
      <Modal visible={settingsVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Einstellungen</Text>

            <View style={styles.settingRow}>
              <Text style={{ color: theme.text, fontSize: 16 }}>Dark Mode</Text>
              <Switch value={darkMode} onValueChange={toggleTheme} />
            </View>

            <TouchableOpacity style={styles.actionButton} onPress={exportBackup}>
              <Text style={styles.actionButtonText}>💾 Backup Exportieren (JSON)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={importBackup}>
              <Text style={styles.actionButtonText}>📂 Backup Importieren (JSON)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.border }]}
              onPress={() => setSettingsVisible(false)}
            >
              <Text style={{ color: theme.text, fontWeight: 'bold' }}>Schließen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  settingsButton: {
    padding: 10,
    borderRadius: 12,
  },
  summaryCard: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  balanceText: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryItemLabel: {
    fontSize: 12,
  },
  incomeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  expenseText: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: '#334155',
  },
  formCard: {
    marginHorizontal: 20,
    marginTop: 15,
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(150,150,150,0.1)',
  },
  typeButtonText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  activeTypeText: {
    color: '#FFFFFF',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  addButton: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  transItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  transTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  transDate: {
    fontSize: 12,
    marginTop: 2,
  },
  transAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    padding: 20,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#3B82F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
});
