import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
  Switch,
  KeyboardAvoidingView,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let FileSystem = null;
let DocumentPicker = null;

try {
  FileSystem = require('expo-file-system');
} catch (e) {
  console.log('expo-file-system nicht verfügbar');
}

try {
  DocumentPicker = require('expo-document-picker');
} catch (e) {
  console.log('expo-document-picker nicht verfügbar');
}

const STORAGE_KEY = '@haushaltsbuch_transactions_v14';
const THEME_KEY = '@haushaltsbuch_theme_v1';

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [startDate, setStartDate] = useState(''); // DDMMJJJJ
  const [endDate, setEndDate] = useState('');     // DDMMJJJJ
  const [isRecurring, setIsRecurring] = useState(false);

  // Refs für das automatische Durchschalten (Focus-Loop)
  const amountRef = useRef(null);
  const startDateRef = useRef(null);
  const endDateRef = useRef(null);

  // Active Tab: 'new', 'expenses', 'incomes', 'done'
  const [activeTab, setActiveTab] = useState('new');

  // Bearbeitungs-States
  const [editingId, setEditingId] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editType, setEditType] = useState('expense');

  const [darkMode, setDarkMode] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);

  useEffect(() => {
    loadData();
    loadTheme();
  }, []);

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
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
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

  const formatCurrency = (val) => {
    const fixed = Math.abs(val).toFixed(2);
    const parts = fixed.split('.');
    let integerPart = parts[0];
    const decimalPart = parts[1];

    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${integerPart},${decimalPart} €`;
  };

  const formatInputDate = (inputStr) => {
    if (!inputStr) return '';
    const cleaned = inputStr.replace(/\D/g, '');
    if (cleaned.length === 8) {
      const day = cleaned.substring(0, 2);
      const month = cleaned.substring(2, 4);
      const year = cleaned.substring(4, 8);
      return `${day}.${month}.${year}`;
    }
    return inputStr;
  };

  const parseGermanDate = (dateStr) => {
    if (!dateStr || dateStr.trim() === '') return new Date();
    const cleaned = dateStr.replace(/\D/g, '');
    if (cleaned.length !== 8) return null;

    const day = parseInt(cleaned.substring(0, 2), 10);
    const month = parseInt(cleaned.substring(2, 4), 10) - 1;
    const year = parseInt(cleaned.substring(4, 8), 10);
    
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  };

  const formatDateOutput = (date) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
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

    if (isRecurring) {
      const start = parseGermanDate(startDate);
      const end = parseGermanDate(endDate);

      if (!start || !end) {
        Alert.alert('Fehler', 'Bitte geben Sie gültige Datumsangaben im Format DDMMJJJJ ein.');
        return;
      }

      if (start > end) {
        Alert.alert('Fehler', 'Das Startdatum muss vor dem Enddatum liegen.');
        return;
      }

      const newEntries = [];
      let currentDate = new Date(start);
      let count = 0;

      while (currentDate <= end) {
        newEntries.push({
          id: `${Date.now()}-${count}`,
          title: title.trim(),
          amount: parsedAmount,
          type,
          dueDate: formatDateOutput(currentDate),
          isRecurring: true,
          isDone: false
        });

        currentDate.setMonth(currentDate.getMonth() + 1);
        count++;
      }

      setTransactions([...newEntries, ...transactions]);
      Alert.alert('Erfolg', `${newEntries.length} Serieneinträge wurden erstellt!`);
    } else {
      const finalDate = startDate.trim() ? formatInputDate(startDate) : formatDateOutput(new Date());
      const singleEntry = {
        id: Date.now().toString(),
        title: title.trim(),
        amount: parsedAmount,
        type,
        dueDate: finalDate,
        isRecurring: false,
        isDone: false
      };

      setTransactions([singleEntry, ...transactions]);
    }

    setTitle('');
    setAmount('');
    setStartDate('');
    setEndDate('');
    setIsRecurring(false);
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

  const toggleDone = (id) => {
    setTransactions(
      transactions.map(t => (t.id === id ? { ...t, isDone: !t.isDone } : t))
    );
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditAmount(item.amount.toString());
    setEditDueDate(item.dueDate);
    setEditType(item.type);
    setEditModalVisible(true);
  };

  const saveEditedTransaction = () => {
    if (!editTitle.trim() || !editAmount.trim()) {
      Alert.alert('Hinweis', 'Titel und Betrag dürfen nicht leer sein.');
      return;
    }

    const parsedAmount = parseFloat(editAmount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Hinweis', 'Bitte einen gültigen Betrag eingeben.');
      return;
    }

    setTransactions(
      transactions.map((t) =>
        t.id === editingId
          ? {
              ...t,
              title: editTitle.trim(),
              amount: parsedAmount,
              dueDate: editDueDate.trim() ? formatInputDate(editDueDate) : t.dueDate,
              type: editType
            }
          : t
      )
    );

    setEditModalVisible(false);
    setEditingId(null);
  };

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
          Alert.alert('Erfolg', 'Backup gespeichert!');
          return;
        }
      }

      if (FileSystem?.documentDirectory) {
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, dataString, { encoding: FileSystem.EncodingType.UTF8 });
        Alert.alert('Erfolg', `Backup gespeichert unter:\n${fileUri}`);
      } else {
        Alert.alert('Info', 'Dateisystem in dieser Umgebung nicht verfügbar.');
      }
    } catch (e) {
      Alert.alert('Fehler', 'Export fehlgeschlagen.');
    }
  };

  const importBackup = async () => {
    if (!DocumentPicker) {
      Alert.alert('Fehler', 'DocumentPicker nicht verfügbar.');
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
              Alert.alert('Erfolg', 'Daten wiederhergestellt!');
            }
          }
        ]
      );
    } catch (e) {
      Alert.alert('Fehler', 'Import fehlgeschlagen.');
    }
  };

  const incomeTotal = transactions
    .filter(t => t.type === 'income' && !t.isDone)
    .reduce((sum, t) => sum + t.amount, 0);

  const expenseTotal = transactions
    .filter(t => t.type === 'expense' && !t.isDone)
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = incomeTotal - expenseTotal;

  const getFilteredData = () => {
    if (activeTab === 'expenses') {
      return transactions.filter(t => t.type === 'expense' && !t.isDone);
    } else if (activeTab === 'incomes') {
      return transactions.filter(t => t.type === 'income' && !t.isDone);
    } else if (activeTab === 'done') {
      return transactions.filter(t => t.isDone);
    }
    return [];
  };

  const theme = {
    bg: darkMode ? '#0F172A' : '#F8FAFC',
    cardBg: darkMode ? '#1E293B' : '#FFFFFF',
    text: darkMode ? '#F8FAFC' : '#0F172A',
    subText: darkMode ? '#94A3B8' : '#64748B',
    accent: '#3B82F6',
    income: '#10B981',
    expense: '#EF4444',
    border: darkMode ? '#334155' : '#E2E8F0',
    warning: '#F59E0B',
    doneBg: darkMode ? '#111827' : '#F1F5F9'
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
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

          {/* Navigation Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'new' && { backgroundColor: theme.accent }]}
              onPress={() => setActiveTab('new')}
            >
              <Text style={[styles.tabText, activeTab === 'new' && { color: '#FFF' }]}>Neu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'expenses' && { backgroundColor: theme.accent }]}
              onPress={() => setActiveTab('expenses')}
            >
              <Text style={[styles.tabText, activeTab === 'expenses' && { color: '#FFF' }]}>Ausgaben</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'incomes' && { backgroundColor: theme.accent }]}
              onPress={() => setActiveTab('incomes')}
            >
              <Text style={[styles.tabText, activeTab === 'incomes' && { color: '#FFF' }]}>Einnahmen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'done' && { backgroundColor: theme.accent }]}
              onPress={() => setActiveTab('done')}
            >
              <Text style={[styles.tabText, activeTab === 'done' && { color: '#FFF' }]}>Erledigt</Text>
            </TouchableOpacity>
          </View>

          {/* Ansicht für den 'Neu'-Tab */}
          {activeTab === 'new' && (
            <>
              {/* Overview Card */}
              <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.summaryLabel, { color: theme.subText }]}>Gesamtsaldo (Offen)</Text>
                <Text style={[styles.balanceText, { color: balance >= 0 ? theme.income : theme.expense }]}>
                  {balance < 0 ? '-' : ''}{formatCurrency(balance)}
                </Text>

                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryItemLabel, { color: theme.subText }]}>Einnahmen</Text>
                    <Text style={[styles.incomeText, { color: theme.income }]}>+{formatCurrency(incomeTotal)}</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryItemLabel, { color: theme.subText }]}>Ausgaben</Text>
                    <Text style={[styles.expenseText, { color: theme.expense }]}>-{formatCurrency(expenseTotal)}</Text>
                  </View>
                </View>
              </View>

              {/* Input Form */}
              <View style={[styles.formCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 10 }]}>Neuen Eintrag erfassen</Text>
                
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[styles.typeButton, type === 'expense' && { backgroundColor: theme.expense }]}
                    onPress={() => setType('expense')}
                  >
                    <Text style={[styles.typeButtonText, type === 'expense' && styles.activeTypeText]}>Ausgabe</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeButton, type === 'income' && { backgroundColor: theme.income }]}
                    onPress={() => setType('income')}
                  >
                    <Text style={[styles.typeButtonText, type === 'income' && styles.activeTypeText]}>Einnahme</Text>
                  </TouchableOpacity>
                </View>

                {/* Beschreibung */}
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  placeholder="Beschreibung (z.B. Miete)"
                  placeholderTextColor={theme.subText}
                  value={title}
                  onChangeText={setTitle}
                  returnKeyType="next"
                  onSubmitEditing={() => amountRef.current?.focus()}
                  blurOnSubmit={false}
                />

                {/* Betrag */}
                <TextInput
                  ref={amountRef}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  placeholder="Betrag in € (z.B. 650.00)"
                  placeholderTextColor={theme.subText}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  returnKeyType="next"
                  onSubmitEditing={() => startDateRef.current?.focus()}
                  blurOnSubmit={false}
                />

                <View style={styles.recurringToggleRow}>
                  <Text style={{ color: theme.text, fontSize: 13 }}>Monatlicher Serieneintrag?</Text>
                  <Switch value={isRecurring} onValueChange={setIsRecurring} />
                </View>

                {/* Startdatum / Fälligkeitsdatum */}
                <TextInput
                  ref={startDateRef}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  placeholder={isRecurring ? "Startdatum (DDMMJJJJ)" : "Fälligkeitsdatum (DDMMJJJJ)"}
                  placeholderTextColor={theme.subText}
                  keyboardType="numeric"
                  maxLength={8}
                  value={startDate}
                  onChangeText={setStartDate}
                  returnKeyType={isRecurring ? "next" : "done"}
                  onSubmitEditing={() => {
                    if (isRecurring) {
                      endDateRef.current?.focus();
                    } else {
                      addTransaction();
                    }
                  }}
                  blurOnSubmit={!isRecurring}
                />

                {/* Enddatum für Serien */}
                {isRecurring && (
                  <TextInput
                    ref={endDateRef}
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    placeholder="Enddatum (DDMMJJJJ)"
                    placeholderTextColor={theme.subText}
                    keyboardType="numeric"
                    maxLength={8}
                    value={endDate}
                    onChangeText={setEndDate}
                    returnKeyType="done"
                    onSubmitEditing={addTransaction}
                  />
                )}

                <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.accent }]} onPress={addTransaction}>
                  <Text style={styles.addButtonText}>
                    {isRecurring ? 'Serieneinträge Erstellen' : 'Eintrag Hinzufügen'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Transaction Lists for other tabs */}
          {activeTab !== 'new' && (
            <View style={styles.listContainer}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {activeTab === 'expenses' && 'Offene Ausgaben'}
                {activeTab === 'incomes' && 'Offene Einnahmen'}
                {activeTab === 'done' && 'Erledigte Einträge'}
              </Text>

              {getFilteredData().length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.subText }]}>Keine Einträge in diesem Tab vorhanden.</Text>
              ) : (
                getFilteredData().map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.transItem,
                      {
                        backgroundColor: item.isDone ? theme.doneBg : theme.cardBg,
                        borderColor: theme.border,
                        opacity: item.isDone ? 0.75 : 1
                      }
                    ]}
                  >
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => openEditModal(item)}
                    >
                      <Text
                        style={[
                          styles.transTitle,
                          {
                            color: theme.text,
                            textDecorationLine: item.isDone ? 'line-through' : 'none',
                            fontWeight: item.isDone ? '400' : '500'
                          }
                        ]}
                      >
                        {item.title} {item.isDone ? ' (Erledigt)' : ''}
                      </Text>
                      <Text style={[styles.transDate, { color: item.isDone ? theme.subText : theme.warning }]}>
                        Frist: {item.dueDate}
                      </Text>
                    </TouchableOpacity>

                    <Text
                      style={[
                        styles.transAmount,
                        { color: item.type === 'income' ? theme.income : theme.expense }
                      ]}
                    >
                      {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.doneButton,
                        { backgroundColor: item.isDone ? theme.accent : theme.income }
                      ]}
                      onPress={() => toggleDone(item.id)}
                    >
                      <Text style={styles.doneButtonText}>{item.isDone ? '↩ Rückgängig' : '✓ Erledigt'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteTransaction(item.id)}
                    >
                      <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 16 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Eintrag Bearbeiten</Text>

            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeButton, editType === 'expense' && { backgroundColor: theme.expense }]}
                onPress={() => setEditType('expense')}
              >
                <Text style={[styles.typeButtonText, editType === 'expense' && styles.activeTypeText]}>Ausgabe</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, editType === 'income' && { backgroundColor: theme.income }]}
                onPress={() => setEditType('income')}
              >
                <Text style={[styles.typeButtonText, editType === 'income' && styles.activeTypeText]}>Einnahme</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="Titel"
              placeholderTextColor={theme.subText}
              value={editTitle}
              onChangeText={setEditTitle}
            />

            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="Betrag"
              placeholderTextColor={theme.subText}
              keyboardType="decimal-pad"
              value={editAmount}
              onChangeText={setEditAmount}
            />

            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="Fälligkeitsdatum (DDMMJJJJ)"
              placeholderTextColor={theme.subText}
              keyboardType="numeric"
              maxLength={8}
              value={editDueDate}
              onChangeText={setEditDueDate}
            />

            <TouchableOpacity style={styles.actionButton} onPress={saveEditedTransaction}>
              <Text style={styles.actionButtonText}>Änderungen Speichern</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.border }]}
              onPress={() => setEditModalVisible(false)}
            >
              <Text style={{ color: theme.text, fontWeight: 'bold' }}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  settingsButton: {
    padding: 8,
    borderRadius: 10,
  },
  summaryCard: {
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 13,
    marginBottom: 2,
  },
  balanceText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
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
    fontSize: 11,
  },
  incomeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  expenseText: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 25,
    backgroundColor: '#334155',
  },
  formCard: {
    marginHorizontal: 20,
    marginTop: 5,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: 'rgba(150,150,150,0.1)',
  },
  typeButtonText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
  activeTypeText: {
    color: '#FFFFFF',
  },
  recurringToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    fontSize: 13,
  },
  addButton: {
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 5,
    marginBottom: 15,
    borderRadius: 8,
    backgroundColor: 'rgba(150,150,150,0.1)',
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  listContainer: {
    marginHorizontal: 20,
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  transItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  transTitle: {
    fontSize: 15,
  },
  transDate: {
    fontSize: 12,
    marginTop: 2,
  },
  transAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  doneButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 6,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  actionButton: {
    backgroundColor: '#3B82F6',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
});
