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

const STORAGE_KEY = '@haushaltsbuch_profiles_v34';
const THEME_KEY = '@haushaltsbuch_theme_v1';

export default function App() {
  // Profile & Daten Verwaltung
  const [profiles, setProfiles] = useState(['Haushalt Standard']);
  const [activeProfile, setActiveProfile] = useState('Haushalt Standard');
  const [allTransactions, setAllTransactions] = useState({ 'Haushalt Standard': [] });
  
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [startDate, setStartDate] = useState(''); // DDMMJJJJ
  const [endDate, setEndDate] = useState('');     // DDMMJJJJ
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');

  const [statsStartDate, setStatsStartDate] = useState('');
  const [statsEndDate, setStatsEndDate] = useState('');

  const amountRef = useRef(null);
  const startDateRef = useRef(null);
  const endDateRef = useRef(null);
  const statsEndDateRef = useRef(null);

  const [activeTab, setActiveTab] = useState('new');

  const [editingId, setEditingId] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editType, setEditType] = useState('expense');

  // Standardmäßig im Hellmodus starten (false)
  const [darkMode, setDarkMode] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [newProfileModalVisible, setNewProfileModalVisible] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  useEffect(() => {
    loadData();
    loadTheme();
  }, []);

  useEffect(() => {
    saveData(allTransactions, profiles);
  }, [allTransactions, profiles]);

  const loadData = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      if (jsonValue != null) {
        const parsed = JSON.parse(jsonValue);
        if (parsed.profiles && parsed.transactions) {
          setProfiles(parsed.profiles);
          setAllTransactions(parsed.transactions);
          if (parsed.profiles.length > 0) {
            setActiveProfile(parsed.profiles[0]);
          }
        }
      }
    } catch (e) {
      Alert.alert('Fehler', 'Daten konnten nicht geladen werden.');
    }
  };

  const saveData = async (transactions, profs) => {
    try {
      const dataToSave = JSON.stringify({ profiles: profs, transactions });
      await AsyncStorage.setItem(STORAGE_KEY, dataToSave);
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

  const addNewProfile = () => {
    const trimmed = newProfileName.trim();
    if (!trimmed) {
      Alert.alert('Hinweis', 'Bitte einen Profilnamen eingeben.');
      return;
    }
    if (profiles.includes(trimmed)) {
      Alert.alert('Hinweis', 'Dieses Profil existiert bereits.');
      return;
    }

    const updatedProfiles = [...profiles, trimmed];
    const updatedTransactions = { ...allTransactions, [trimmed]: [] };

    setProfiles(updatedProfiles);
    setAllTransactions(updatedTransactions);
    setActiveProfile(trimmed);
    setNewProfileName('');
    setNewProfileModalVisible(false);
    setSettingsVisible(false);
  };

  const currentTransactions = allTransactions[activeProfile] || [];

  const updateCurrentTransactions = (newTrans) => {
    setAllTransactions({
      ...allTransactions,
      [activeProfile]: newTrans
    });
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
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      return null;
    }
    return isNaN(date.getTime()) ? null : date;
  };

  const dateToNumber = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('.');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      return null;
    }

    return parseInt(`${parts[2]}${parts[1]}${parts[0]}`, 10);
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

        currentDate.setMonth(currentDate.getMonth() + recurrenceInterval);
        count++;
      }

      updateCurrentTransactions([...newEntries, ...currentTransactions]);
      Alert.alert('Erfolg', `${newEntries.length} Serieneinträge für "${activeProfile}" erstellt!`);
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

      updateCurrentTransactions([singleEntry, ...currentTransactions]);
    }

    setTitle('');
    setAmount('');
    setStartDate('');
    setEndDate('');
    setIsRecurring(false);
    setRecurrenceInterval(1);
  };

  const deleteTransaction = (id) => {
    Alert.alert('Löschen', 'Möchten Sie diesen Eintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => updateCurrentTransactions(currentTransactions.filter(t => t.id !== id))
      }
    ]);
  };

  const toggleDone = (id) => {
    updateCurrentTransactions(
      currentTransactions.map(t => (t.id === id && t.type === 'expense' ? { ...t, isDone: !t.isDone } : t))
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

    updateCurrentTransactions(
      currentTransactions.map((t) =>
        t.id === editingId
          ? {
              ...t,
              title: editTitle.trim(),
              amount: parsedAmount,
              dueDate: editDueDate.trim() ? formatInputDate(editDueDate) : t.dueDate,
              type: editType,
              isDone: editType === 'income' ? false : t.isDone
            }
          : t
      )
    );

    setEditModalVisible(false);
    setEditingId(null);
  };

  const handleStatsStartDateChange = (text) => {
    setStatsStartDate(text);
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length === 8 && statsEndDateRef.current) {
      statsEndDateRef.current.focus();
    }
  };

  const exportBackup = async () => {
    try {
      const dataString = JSON.stringify({ profiles, transactions: allTransactions }, null, 2);
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
      Alert.alert('Hinweis', 'DocumentPicker ist in dieser Umgebung (z.B. Expo Go) eingeschränkt. Bitte nutzen Sie eine Entwicklungsversion oder Standalone-App.');
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

      Alert.alert(
        'Wiederherstellung',
        'Möchten Sie alle vorhandenen Profile und Daten durch dieses Backup ersetzen?',
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Wiederherstellen',
            style: 'destructive',
            onPress: () => {
              if (parsedData.profiles && parsedData.transactions) {
                setProfiles(parsedData.profiles);
                setAllTransactions(parsedData.transactions);
                setActiveProfile(parsedData.profiles[0]);
              } else if (Array.isArray(parsedData)) {
                // Abwärtskompatibilität für alte Backups
                setProfiles(['Haushalt Standard']);
                setAllTransactions({ 'Haushalt Standard': parsedData });
                setActiveProfile('Haushalt Standard');
              }
              setSettingsVisible(false);
              Alert.alert('Erfolg', 'Daten erfolgreich wiederhergestellt!');
            }
          }
        ]
      );
    } catch (e) {
      Alert.alert('Fehler', 'Import fehlgeschlagen.');
    }
  };

  const incomeTotal = currentTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenseTotal = currentTransactions
    .filter(t => t.type === 'expense' && !t.isDone)
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = incomeTotal - expenseTotal;

  const getFilteredExpensesForStats = () => {
    let list = currentTransactions.filter(t => t.type === 'expense');

    const sFormatted = formatInputDate(statsStartDate);
    const eFormatted = formatInputDate(statsEndDate);

    const sNum = dateToNumber(sFormatted);
    const eNum = dateToNumber(eFormatted);

    if (sNum && eNum) {
      list = list.filter(t => {
        const itemNum = dateToNumber(t.dueDate);
        return itemNum && itemNum >= sNum && itemNum <= eNum;
      });
    }

    return list;
  };

  const statsExpenses = getFilteredExpensesForStats();
  const totalStatsExpenseAmount = statsExpenses.reduce((sum, t) => sum + t.amount, 0);

  const groupedByCreditor = {};
  statsExpenses.forEach(t => {
    const key = t.title.trim();
    if (!groupedByCreditor[key]) {
      groupedByCreditor[key] = 0;
    }
    groupedByCreditor[key] += t.amount;
  });

  const creditorStatsList = Object.keys(groupedByCreditor).map(title => {
    const amount = groupedByCreditor[title];
    const percentage = totalStatsExpenseAmount > 0 ? (amount / totalStatsExpenseAmount) * 100 : 0;
    return { title, amount, percentage };
  }).sort((a, b) => b.amount - a.amount);

  const getPercentageColor = (pct) => {
    if (pct >= 75) return '#EF4444';
    if (pct >= 50) return '#F59E0B';
    return '#10B981';
  };

  const getFilteredData = () => {
    let list = [];
    if (activeTab === 'expenses') {
      list = currentTransactions.filter(t => t.type === 'expense' && !t.isDone);
    } else if (activeTab === 'incomes') {
      list = currentTransactions.filter(t => t.type === 'income');
    } else if (activeTab === 'done') {
      list = currentTransactions.filter(t => t.type === 'expense' && t.isDone);
    }

    if (searchQuery.trim() !== '') {
      list = list.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return list;
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
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Haushaltsbuch</Text>
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>Aktives Profil: {activeProfile}</Text>
            </View>
            <TouchableOpacity
              style={[styles.settingsButton, { backgroundColor: theme.cardBg }]}
              onPress={() => setSettingsVisible(true)}
            >
              <Text style={{ color: theme.text, fontSize: 18 }}>⚙️</Text>
            </TouchableOpacity>
          </View>

          {/* Profil-Auswahl Leiste */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.profileBar}>
            {profiles.map((prof) => (
              <TouchableOpacity
                key={prof}
                style={[
                  styles.profileChip,
                  { borderColor: theme.border, backgroundColor: theme.cardBg },
                  activeProfile === prof && { backgroundColor: theme.accent, borderColor: theme.accent }
                ]}
                onPress={() => setActiveProfile(prof)}
              >
                <Text style={[styles.profileChipText, { color: theme.text }, activeProfile === prof && { color: '#FFF' }]}>
                  🏠 {prof}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.profileChip, { borderColor: theme.accent, backgroundColor: 'transparent', borderStyle: 'dashed' }]}
              onPress={() => setNewProfileModalVisible(true)}
            >
              <Text style={[styles.profileChipText, { color: theme.accent }]}>+ Neues Profil</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Navigation Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'new' && { backgroundColor: theme.accent }]}
              onPress={() => { setActiveTab('new'); setSearchQuery(''); }}
            >
              <Text style={[styles.tabText, activeTab === 'new' && { color: '#FFF' }]}>Neu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'stats' && { backgroundColor: theme.accent }]}
              onPress={() => { setActiveTab('stats'); setSearchQuery(''); }}
            >
              <Text style={[styles.tabText, activeTab === 'stats' && { color: '#FFF' }]}>Statistik</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'expenses' && { backgroundColor: theme.accent }]}
              onPress={() => { setActiveTab('expenses'); setSearchQuery(''); }}
            >
              <Text style={[styles.tabText, activeTab === 'expenses' && { color: '#FFF' }]}>Ausgaben</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'incomes' && { backgroundColor: theme.accent }]}
              onPress={() => { setActiveTab('incomes'); setSearchQuery(''); }}
            >
              <Text style={[styles.tabText, activeTab === 'incomes' && { color: '#FFF' }]}>Einnahmen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'done' && { backgroundColor: theme.accent }]}
              onPress={() => { setActiveTab('done'); setSearchQuery(''); }}
            >
              <Text style={[styles.tabText, activeTab === 'done' && { color: '#FFF' }]}>Erledigt</Text>
            </TouchableOpacity>
          </View>

          {/* Ansicht für den 'Neu'-Tab */}
          {activeTab === 'new' && (
            <>
              <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.summaryLabel, { color: theme.subText }]}>Gesamtsaldo ({activeProfile})</Text>
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

              <View style={[styles.formCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 10 }]}>Eintrag erfassen ({activeProfile})</Text>
                
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
                  <Text style={{ color: theme.text, fontSize: 13 }}>Serieneintrag?</Text>
                  <Switch value={isRecurring} onValueChange={setIsRecurring} />
                </View>

                {isRecurring && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ color: theme.subText, fontSize: 12, marginBottom: 4 }}>Wiederholung:</Text>
                    <View style={styles.intervalRow}>
                      {[1, 2, 3, 6, 12].map((months) => (
                        <TouchableOpacity
                          key={months}
                          style={[
                            styles.intervalButton,
                            { borderColor: theme.border },
                            recurrenceInterval === months && { backgroundColor: theme.accent, borderColor: theme.accent }
                          ]}
                          onPress={() => setRecurrenceInterval(months)}
                        >
                          <Text
                            style={[
                              styles.intervalButtonText,
                              { color: theme.text },
                              recurrenceInterval === months && { color: '#FFF' }
                            ]}
                          >
                            {months === 1 ? '1 Mo' : `${months} Mo`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

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

          {/* Statistik Tab */}
          {activeTab === 'stats' && (
            <View style={styles.listContainer}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Ausgaben nach Forderer ({activeProfile})</Text>

              <View style={[styles.statsFilterCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={styles.statsFilterHeaderRow}>
                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: 'bold' }}>Optionaler Zeitraum:</Text>
                  {(statsStartDate.length > 0 || statsEndDate.length > 0) && (
                    <TouchableOpacity onPress={() => { setStatsStartDate(''); setStatsEndDate(''); }}>
                      <Text style={{ color: theme.accent, fontSize: 12, fontWeight: 'bold' }}>Zurücksetzen ✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <TextInput
                    style={[styles.dateInputSingle, { color: theme.text, borderColor: theme.border }]}
                    placeholder="Von (DDMMJJJJ)"
                    placeholderTextColor={theme.subText}
                    keyboardType="numeric"
                    maxLength={8}
                    value={statsStartDate}
                    onChangeText={handleStatsStartDateChange}
                  />
                  <TextInput
                    ref={statsEndDateRef}
                    style={[styles.dateInputSingle, { color: theme.text, borderColor: theme.border }]}
                    placeholder="Bis (DDMMJJJJ)"
                    placeholderTextColor={theme.subText}
                    keyboardType="numeric"
                    maxLength={8}
                    value={statsEndDate}
                    onChangeText={setStatsEndDate}
                  />
                </View>
              </View>

              <View style={[styles.statsCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={[styles.statsHeaderTitle, { color: theme.text }]}>Gesamtausgaben:</Text>
                  <Text style={{ color: theme.expense, fontWeight: 'bold', fontSize: 16 }}>{formatCurrency(totalStatsExpenseAmount)}</Text>
                </View>

                <View style={[styles.dividerFull, { backgroundColor: theme.border }]} />

                {creditorStatsList.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.subText, marginTop: 10 }]}>Keine Ausgaben im gewählten Zeitraum.</Text>
                ) : (
                  creditorStatsList.map((item, index) => {
                    const pctColor = getPercentageColor(item.percentage);
                    return (
                      <View key={index} style={styles.creditorRow}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.creditorLineRow}>
                            <Text style={[styles.creditorTitleText, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
                            <View style={styles.creditorValuesContainer}>
                              <Text style={[styles.creditorAmountText, { color: theme.text }]} numberOfLines={1}>{formatCurrency(item.amount)}</Text>
                              <Text style={[styles.creditorPercentText, { color: pctColor }]} numberOfLines={1}>{item.percentage.toFixed(1)}%</Text>
                            </View>
                          </View>
                          <View style={styles.miniBarBg}>
                            <View style={[styles.miniBarFill, { width: `${item.percentage}%`, backgroundColor: pctColor }]} />
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* Transaction Lists */}
          {activeTab !== 'new' && activeTab !== 'stats' && (
            <View style={styles.listContainer}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {activeTab === 'expenses' && 'Offene Ausgaben'}
                {activeTab === 'incomes' && 'Einnahmen'}
                {activeTab === 'done' && 'Erledigte Ausgaben'} ({activeProfile})
              </Text>

              <TextInput
                style={[styles.searchInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBg }]}
                placeholder="🔍 Suchen (z.B. Miete, Netflix)..."
                placeholderTextColor={theme.subText}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              {getFilteredData().length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.subText }]}>Keine Einträge gefunden.</Text>
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

                    {item.type === 'expense' && (
                      <TouchableOpacity
                        style={[
                          styles.doneButton,
                          { backgroundColor: item.isDone ? theme.accent : theme.income }
                        ]}
                        onPress={() => toggleDone(item.id)}
                      >
                        <Text style={styles.doneButtonText}>{item.isDone ? '↩ Rückgängig' : '✓ Erledigt'}</Text>
                      </TouchableOpacity>
                    )}

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
              placeholder="Fälligkeitsdatum (DD.MM.JJJJ)"
              placeholderTextColor={theme.subText}
              keyboardType="numeric"
              maxLength={10}
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
              style={[styles.actionButton, { backgroundColor: '#10B981' }]} 
              onPress={() => { setSettingsVisible(false); setManualVisible(true); }}
            >
              <Text style={styles.actionButtonText}>📖 Benutzerhandbuch öffnen</Text>
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

      {/* Neues Profil Modal */}
      <Modal visible={newProfileModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Neues Profil erstellen</Text>
            
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="Profilname (z.B. WG, Auto, Urlaub)"
              placeholderTextColor={theme.subText}
              value={newProfileName}
              onChangeText={setNewProfileName}
            />

            <TouchableOpacity style={styles.actionButton} onPress={addNewProfile}>
              <Text style={styles.actionButtonText}>Profil Hinzufügen</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.border }]}
              onPress={() => setNewProfileModalVisible(false)}
            >
              <Text style={{ color: theme.text, fontWeight: 'bold' }}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Benutzerhandbuch Modal */}
      <Modal visible={manualVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, maxHeight: '80%' }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>📖 Benutzerhandbuch</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.manualHeading, { color: theme.text }]}>1. Profile (Haushalte)</Text>
              <Text style={[styles.manualText, { color: theme.subText }]}>
                Oben in der Leiste kannst du zwischen verschiedenen Profilen (z.B. Hauptwohnsitz, WG, Urlaub) wechseln oder neue anlegen. Jedes Profil speichert seine Ausgaben und Einnahmen separat.
              </Text>

              <Text style={[styles.manualHeading, { color: theme.text }]}>2. Einträge & Serien</Text>
              <Text style={[styles.manualText, { color: theme.subText }]}>
                • Beträge mit Punkt oder Komma (z.B. 650.00).{'\n'}
                • Datumsangaben im Format DDMMJJJJ.{'\n'}
                • Serieneinträge unterstützen flexible Intervalle (1, 2, 3, 6 oder 12 Monate).
              </Text>

              <Text style={[styles.manualHeading, { color: theme.text }]}>3. Statistik & Backup</Text>
              <Text style={[styles.manualText, { color: theme.subText }]}>
                Die Statistik zeigt rein die Ausgaben des aktiven Profils. Über das Zahnrad ⚙️ erreichst du den hellen/dunklen Modus sowie die Backup-Funktionen.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.border, marginTop: 15 }]}
              onPress={() => setManualVisible(false)}
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
  profileBar: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  profileChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileChipText: {
    fontSize: 12,
    fontWeight: '600',
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
  dividerFull: {
    height: 1,
    width: '100%',
    marginVertical: 10,
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
  intervalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  intervalButton: {
    flex: 1,
    paddingVertical: 6,
    marginHorizontal: 2,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(150,150,150,0.05)',
  },
  intervalButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    fontSize: 13,
  },
  statsFilterCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  statsFilterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateInputSingle: {
    flex: 0.48,
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
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
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(150,150,150,0.1)',
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabText: {
    fontSize: 11,
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
  statsCard: {
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
  },
  statsHeaderTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  creditorRow: {
    marginBottom: 12,
  },
  creditorLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  creditorTitleText: {
    flex: 1,
    fontWeight: '600',
    fontSize: 14,
  },
  creditorValuesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creditorAmountText: {
    fontWeight: 'bold',
    fontSize: 14,
    width: 95,
    textAlign: 'right',
  },
  creditorPercentText: {
    fontWeight: 'bold',
    fontSize: 13,
    width: 55,
    textAlign: 'right',
  },
  miniBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(150,150,150,0.15)',
    overflow: 'hidden',
    marginTop: 2,
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 4,
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
  manualHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4,
  },
  manualText: {
    fontSize: 13,
    lineHeight: 18,
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
