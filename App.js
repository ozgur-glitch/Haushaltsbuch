import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
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
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

const STORAGE_KEY = '@haushaltsbuch_profiles_v39';
const THEME_KEY = '@haushaltsbuch_theme_v1';

export default function App() {
  const [profiles, setProfiles] = useState(['Haushalt Standard']);
  const [activeProfile, setActiveProfile] = useState('Haushalt Standard');
  const [allTransactions, setAllTransactions] = useState({ 'Haushalt Standard': [] });
  
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');

  // Sortierung für offene Ausgaben ('date' oder 'title')
  const [expenseSortBy, setExpenseSortBy] = useState('date');

  // Zeitraum-Filter für Statistik
  const [statsStartDate, setStatsStartDate] = useState('');
  const [statsEndDate, setStatsEndDate] = useState('');

  // Zeitraum-Filter für Gesamtsaldo
  const [balanceStartDate, setBalanceStartDate] = useState('');
  const [balanceEndDate, setBalanceEndDate] = useState('');

  const amountRef = useRef(null);
  const startDateRef = useRef(null);
  const endDateRef = useRef(null);
  const statsEndDateRef = useRef(null);
  const balanceEndDateRef = useRef(null);

  const [activeTab, setActiveTab] = useState('new');

  const [editingId, setEditingId] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editType, setEditType] = useState('expense');

  const [darkMode, setDarkMode] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [newProfileModalVisible, setNewProfileModalVisible] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  // Profile-Verwaltung / Umbenennen Modal
  const [manageProfilesVisible, setManageProfilesVisible] = useState(false);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [targetProfileToEdit, setTargetProfileToEdit] = useState(null);
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);

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

  const handleExportJsonFile = async () => {
    try {
      const exportPayload = { profiles, transactions: allTransactions };
      const jsonString = JSON.stringify(exportPayload, null, 2);
      const fileName = `haushaltsbuch_backup_${new Date().toISOString().slice(0, 10)}.json`;

      if (Platform.OS === 'android' && FileSystem && FileSystem.StorageAccessFramework) {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const uri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'application/json'
          );
          await FileSystem.writeAsStringAsync(uri, jsonString, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          Alert.alert('Erfolg', 'Backup wurde im gewählten Ordner gespeichert!');
        }
      } else if (FileSystem && FileSystem.documentDirectory) {
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, jsonString, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        Alert.alert('Erfolg', `Gespeichert unter:\n${fileUri}`);
      } else {
        Alert.alert('Fehler', 'Export wird auf diesem Gerät nicht unterstützt.');
      }
    } catch (e) {
      Alert.alert('Fehler', 'Export der JSON-Datei ist fehlgeschlagen: ' + e.message);
    }
  };

  const handleImportJsonFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileUri = result.assets[0].uri;
        const fileContent = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        
        const parsed = JSON.parse(fileContent);

        if (parsed.profiles && parsed.transactions) {
          setProfiles(parsed.profiles);
          setAllTransactions(parsed.transactions);
          setActiveProfile(parsed.profiles[0]);
          setSettingsVisible(false);
          Alert.alert("Erfolg", "Backup erfolgreich aus JSON-Datei importiert!");
        } else if (Array.isArray(parsed)) {
          setProfiles(['Haushalt Standard']);
          setAllTransactions({ 'Haushalt Standard': parsed });
          setActiveProfile('Haushalt Standard');
          setSettingsVisible(false);
          Alert.alert("Erfolg", "Backup erfolgreich aus JSON-Datei importiert!");
        } else {
          Alert.alert("Fehler", "Die ausgewählte Datei hat ein ungültiges Format.");
        }
      }
    } catch (e) {
      Alert.alert("Fehler beim Import", "Die Datei konnte nicht gelesen oder verarbeitet werden.");
    }
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
  };

  const openEditProfileModal = (profName) => {
    setTargetProfileToEdit(profName);
    setEditingProfileName(profName);
    setEditProfileModalVisible(true);
  };

  const saveEditedProfileName = () => {
    const trimmed = editingProfileName.trim();
    if (!trimmed) {
      Alert.alert('Hinweis', 'Der Profilname darf nicht leer sein.');
      return;
    }
    if (trimmed !== targetProfileToEdit && profiles.includes(trimmed)) {
      Alert.alert('Hinweis', 'Ein Profil mit diesem Namen existiert bereits.');
      return;
    }

    const updatedProfiles = profiles.map(p => p === targetProfileToEdit ? trimmed : p);
    const updatedTransactions = { ...allTransactions };
    
    if (targetProfileToEdit !== trimmed) {
      updatedTransactions[trimmed] = updatedTransactions[targetProfileToEdit] || [];
      delete updatedTransactions[targetProfileToEdit];
    }

    setProfiles(updatedProfiles);
    setAllTransactions(updatedTransactions);
    if (activeProfile === targetProfileToEdit) {
      setActiveProfile(trimmed);
    }
    setEditProfileModalVisible(false);
    setTargetProfileToEdit(null);
    setEditingProfileName('');
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

  const handleBalanceStartDateChange = (text) => {
    setBalanceStartDate(text);
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length === 8 && balanceEndDateRef.current) {
      balanceEndDateRef.current.focus();
    }
  };

  const getFilteredTransactionsForBalance = () => {
    const sFormatted = formatInputDate(balanceStartDate);
    const eFormatted = formatInputDate(balanceEndDate);

    const sNum = dateToNumber(sFormatted);
    const eNum = dateToNumber(eFormatted);

    if (sNum && eNum) {
      return currentTransactions.filter(t => {
        const itemNum = dateToNumber(t.dueDate);
        return itemNum && itemNum >= sNum && itemNum <= eNum;
      });
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return currentTransactions.filter(t => {
      const d = parseGermanDate(t.dueDate);
      return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  };

  const balanceTransactions = getFilteredTransactionsForBalance();

  const incomeTotal = balanceTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenseTotal = balanceTransactions
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

  // Angepasste Farblogik für Statistik (%):
  // < 10% = grün
  // 10% - 19.99% = gelb
  // 20% - 100% = rot (wird ab 20% aufwärts stufenweise dunkler)
  const getPercentageColor = (pct) => {
    if (pct < 10) return '#10B981'; // Grün
    if (pct < 20) return '#F59E0B'; // Gelb
    
    // Ab 20% bis 100% fließend zu dunklem Rot (Hex-Werte von hellrot bis tiefes Dunkelrot)
    // Bei 20% -> #EF4444, bei 100% -> #7F1D1D
    const ratio = Math.min((pct - 20) / 80, 1);
    const r = Math.round(239 - ratio * (239 - 127)); // 239 -> 127
    const g = Math.round(68 - ratio * (68 - 29));     // 68 -> 29
    const b = Math.round(68 - ratio * (68 - 29));     // 68 -> 29
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getFilteredData = () => {
    let list = [];
    if (activeTab === 'expenses') {
      list = currentTransactions.filter(t => t.type === 'expense' && !t.isDone);
      
      // Sortierung für offene Ausgaben
      list.sort((a, b) => {
        if (expenseSortBy === 'date') {
          const numA = dateToNumber(a.dueDate) || 0;
          const numB = dateToNumber(b.dueDate) || 0;
          return numA - numB; // Nächstes Datum zuerst
        } else {
          return a.title.localeCompare(b.title); // Nach Beschreibung (Alphabetisch)
        }
      });
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

  const isBalanceFilteredManually = balanceStartDate.length > 0 || balanceEndDate.length > 0;

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
              {/* Saldo Zeitraum-Filter */}
              <View style={[styles.statsFilterCard, { backgroundColor: theme.cardBg, borderColor: theme.border, marginHorizontal: 20 }]}>
                <View style={styles.statsFilterHeaderRow}>
                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: 'bold' }}>
                    Saldo-Zeitraum: {isBalanceFilteredManually ? 'Manuell' : 'Aktueller Monat'}
                  </Text>
                  {isBalanceFilteredManually && (
                    <TouchableOpacity onPress={() => { setBalanceStartDate(''); setBalanceEndDate(''); }}>
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
                    value={balanceStartDate}
                    onChangeText={handleBalanceStartDateChange}
                  />
                  <TextInput
                    ref={balanceEndDateRef}
                    style={[styles.dateInputSingle, { color: theme.text, borderColor: theme.border }]}
                    placeholder="Bis (DDMMJJJJ)"
                    placeholderTextColor={theme.subText}
                    keyboardType="numeric"
                    maxLength={8}
                    value={balanceEndDate}
                    onChangeText={setBalanceEndDate}
                  />
                </View>
              </View>

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

              {/* Sortier-Optionen nur im Ausgaben-Tab anzeigen */}
              {activeTab === 'expenses' && (
                <View style={styles.sortBarContainer}>
                  <Text style={{ color: theme.subText, fontSize: 12, alignSelf: 'center', marginRight: 6 }}>Sortieren nach:</Text>
                  <TouchableOpacity
                    style={[
                      styles.sortChip,
                      { borderColor: theme.border, backgroundColor: theme.cardBg },
                      expenseSortBy === 'date' && { backgroundColor: theme.accent, borderColor: theme.accent }
                    ]}
                    onPress={() => setExpenseSortBy('date')}
                  >
                    <Text style={[styles.sortChipText, { color: theme.text }, expenseSortBy === 'date' && { color: '#FFF' }]}>
                      Frist (Datum)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sortChip,
                      { borderColor: theme.border, backgroundColor: theme.cardBg },
                      expenseSortBy === 'title' && { backgroundColor: theme.accent, borderColor: theme.accent }
                    ]}
                    onPress={() => setExpenseSortBy('title')}
                  >
                    <Text style={[styles.sortChipText, { color: theme.text }, expenseSortBy === 'title' && { color: '#FFF' }]}>
                      Beschreibung
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

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

      {/* Edit Transaction Modal */}
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

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#8B5CF6' }]} 
              onPress={() => { setSettingsVisible(false); setManageProfilesVisible(true); }}
            >
              <Text style={styles.actionButtonText}>✏️ Profile verwalten & umbenennen</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleExportJsonFile}>
              <Text style={styles.actionButtonText}>💾 Backup Exportieren (JSON)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleImportJsonFile}>
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

      {/* Profile verwalten Modal */}
      <Modal visible={manageProfilesVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, maxHeight: '80%' }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Profile verwalten</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {profiles.map((prof) => (
                <View key={prof} style={styles.profileManageRow}>
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', flex: 1 }}>🏠 {prof}</Text>
                  <TouchableOpacity
                    style={styles.profileEditBtn}
                    onPress={() => openEditProfileModal(prof)}
                  >
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>Umbenennen</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.border, marginTop: 15 }]}
              onPress={() => setManageProfilesVisible(false)}
            >
              <Text style={{ color: theme.text, fontWeight: 'bold' }}>Schließen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Einzelnes Profil umbenennen Modal */}
      <Modal visible={editProfileModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Profil umbenennen</Text>

            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="Neuer Profilname"
              placeholderTextColor={theme.subText}
              value={editingProfileName}
              onChangeText={setEditingProfileName}
            />

            <TouchableOpacity style={styles.actionButton} onPress={saveEditedProfileName}>
              <Text style={styles.actionButtonText}>Speichern</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.border }]}
              onPress={() => setEditProfileModalVisible(false)}
            >
              <Text style={{ color: theme.text, fontWeight: 'bold' }}>Abbrechen</Text>
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
              <Text style={[styles.manualHeading, { color: theme.text }]}>1. Profile (Haushalte) & Umbenennen</Text>
              <Text style={[styles.manualText, { color: theme.subText }]}>
                Über die obere Leiste wechselst du schnell zwischen Profilen. Neue Profile erstellst du mit „+ Neues Profil“. Über ⚙️ Einstellungen ➔ „Profile verwalten & umbenennen“ kannst du bestehende Profile jederzeit umbenennen.
              </Text>

              <Text style={[styles.manualHeading, { color: theme.text }]}>2. Gesamtsaldo & Zeitraum-Filter</Text>
              <Text style={[styles.manualText, { color: theme.subText }]}>
                Der Gesamtsaldo berechnet standardmäßig alle Einträge des **aktuellen Monats**. Über die Eingabefelder „Von“ und „Bis“ direkt über der Saldo-Karte kannst du einen beliebigen Zeitraum im Format DDMMJJJJ festlegen. Mit „Zurücksetzen ✕“ kehrst du zum Monatsfilter zurück.
              </Text>

              <Text style={[styles.manualHeading, { color: theme.text }]}>3. Offene Ausgaben & Sortierung</Text>
              <Text style={[styles.manualText, { color: theme.subText }]}>
                Offene Ausgaben werden standardmäßig nach der anstehendsten Frist (Datum) sortiert. Über die Sortier-Leiste oben in der Ausgabenansicht kannst du flexibel zwischen **Frist (Datum)** und **Beschreibung** umschalten.
              </Text>

              <Text style={[styles.manualHeading, { color: theme.text }]}>4. Statistik & Prozentfarben</Text>
              <Text style={[styles.manualText, { color: theme.subText }]}>
                Die Ausgabenstatistik fasst Ausgaben nach Forderer zusammen. Die Prozentbalken sind farblich abgestimmt:{'\n'}
                • Unter 10%: Grün{'\n'}
                • 10% bis 19,99%: Gelb{'\n'}
                • Ab 20% bis 100%: Rot (wird bei höheren Prozentwerten automatisch dunkler).
              </Text>

              <Text style={[styles.manualHeading, { color: theme.text }]}>5. Einstellungen, Dark Mode & Backup</Text>
              <Text style={[styles.manualText, { color: theme.subText }]}>
                Im Einstellungs-Menü ⚙️ wählst du deinen bevorzugten Theme-Modus und kannst deine JSON-Backups sicher speichern oder laden.
              </Text>

              <Text style={[styles.manualHeading, { color: theme.text }]}>6. Entwicklerinfo</Text>
              <Text style={[styles.manualText, { color: theme.subText }]}>
                Entwickler: Özgür Cetin{'\n'}
                E-Mail: ozgur.cetin@web.de
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
  sortBarContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 6,
  },
  sortChipText: {
    fontSize: 11,
    fontWeight: '600',
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
  profileManageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  profileEditBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
});
