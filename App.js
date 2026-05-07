import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  StatusBar,
  ScrollView,
  Dimensions,
  Animated,
  Keyboard,
  Share,
  Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function App() {
  // --- STATES ---
  const [isDarkMode, setIsDarkMode] = useState(false); 
  const [activeTab, setActiveTab] = useState('add');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState(''); 
  const [searchQuery, setSearchQuery] = useState(''); 
  const [interval, setInterval] = useState(1); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [claims, setClaims] = useState([]);
  const [incomes, setIncomes] = useState([]); 
  const [expandedId, setExpandedId] = useState(null);
  const [importCode, setImportCode] = useState(''); 
  
  // States für Einzelbearbeitung
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editingParams, setEditingParams] = useState(null);

  const endDateRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // --- PERSISTENZ LOGIK ---
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const savedClaims = await AsyncStorage.getItem('@claims_v1');
      const savedIncomes = await AsyncStorage.getItem('@incomes_v1');
      const savedTheme = await AsyncStorage.getItem('@theme_v1');
      
      if (savedClaims) {
        setClaims(JSON.parse(savedClaims).map(c => ({
          ...c,
          dates: c.dates.map(d => ({ ...d, dateObj: new Date(d.dateObj) }))
        })));
      }
      if (savedIncomes) {
        setIncomes(JSON.parse(savedIncomes).map(i => ({
          ...i,
          dates: i.dates.map(d => ({ ...d, dateObj: new Date(d.dateObj) }))
        })));
      }
      if (savedTheme !== null) setIsDarkMode(savedTheme === 'true');
    } catch (e) { console.log("Fehler beim Laden"); }
  };

  const saveData = async (newClaims, newIncomes) => {
    try {
      await AsyncStorage.setItem('@claims_v1', JSON.stringify(newClaims));
      await AsyncStorage.setItem('@incomes_v1', JSON.stringify(newIncomes));
    } catch (e) { console.log("Fehler beim Speichern"); }
  };

  // --- THEME COLORS ---
  const theme = {
    bg: isDarkMode ? '#121212' : '#F8F9FF',
    card: isDarkMode ? '#1C1C1E' : '#FFF',
    text: isDarkMode ? '#FFF' : '#333',
    subText: isDarkMode ? '#8E8E93' : '#A0A0A0',
    inputBg: isDarkMode ? '#1C1C1E' : '#FFF',
    border: isDarkMode ? '#2C2C2E' : '#EFEFEF',
    tabBar: isDarkMode ? '#2C2C2E' : '#FFF',
    detailBg: isDarkMode ? '#242426' : '#FAFBFD'
  };

  // --- BACKUP LOGIK ---
  const handleExport = async () => {
    try {
      const data = JSON.stringify({ claims, incomes });
      await Share.share({ message: data, title: 'Finanz App Backup' });
    } catch (error) { Alert.alert("Fehler", "Export fehlgeschlagen"); }
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importCode);
      if (parsed.claims && parsed.incomes) {
        const restoredClaims = parsed.claims.map(c => ({
          ...c,
          dates: c.dates.map(d => ({ ...d, dateObj: new Date(d.dateObj) }))
        }));
        const restoredIncomes = parsed.incomes.map(i => ({
          ...i,
          dates: i.dates.map(d => ({ ...d, dateObj: new Date(d.dateObj) }))
        }));
        setClaims(restoredClaims);
        setIncomes(restoredIncomes);
        saveData(restoredClaims, restoredIncomes);
        setImportCode('');
        Alert.alert("Erfolg", "Backup erfolgreich importiert!");
        setActiveTab('list');
      } else { throw new Error(); }
    } catch (e) { Alert.alert("Fehler", "Ungültiger Backup-Code."); }
  };

  // --- LOGIK ---
  const handleDateInput = (text, setter, isStart = false) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) {
      formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
    } else if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2, 4)}.${cleaned.slice(4, 8)}`;
    }
    setter(formatted);
    if (cleaned.length === 8) {
      if (isStart && interval !== 0 && activeTab === 'add') {
        endDateRef.current?.focus();
      } else { Keyboard.dismiss(); }
    }
  };

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const parseDate = (str) => {
    if (!str) return null;
    const parts = str.split('.');
    if (parts.length !== 3 || parts[2].length !== 4) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
  };

  const isOverdue = (dateObj) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dateObj <= today;
  };

  const dashboardStatus = useMemo(() => {
    const now = new Date();
    const currentMonthClaims = [];
    claims.forEach(c => {
      c.dates.forEach(d => {
        if (d.dateObj.getMonth() === now.getMonth() && d.dateObj.getFullYear() === now.getFullYear()) {
          currentMonthClaims.push(d);
        }
      });
    });
    if (currentMonthClaims.length === 0) return 'default';
    const hasOverdue = currentMonthClaims.some(d => isOverdue(d.dateObj) && !d.completed);
    if (hasOverdue) return 'overdue';
    const allCompleted = currentMonthClaims.every(d => d.completed);
    if (allCompleted) return 'completed';
    return 'pending';
  }, [claims]);

  useEffect(() => {
    if (dashboardStatus === 'overdue') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else { pulseAnim.setValue(1); }
  }, [dashboardStatus]);

  const getDashboardColor = () => {
    switch (dashboardStatus) {
      case 'overdue': return '#FF3B30';
      case 'completed': return '#28A745';
      case 'pending': return isDarkMode ? '#0A84FF' : '#0A4DAB';
      default: return 'rgba(255,255,255,0.3)';
    }
  };

  const calculateRangeDates = (startStr, endStr, months, val) => {
    let dates = [];
    let current = parseDate(startStr);
    if (!current) return [];
    if (months === 0) {
      dates.push({ id: Math.random().toString(36).substr(2, 9), dateObj: new Date(current), dateString: formatDate(current), value: val, completed: false });
      return dates;
    }
    let end = parseDate(endStr);
    if (!end || current > end) return [];
    while (current <= end) {
      dates.push({ id: Math.random().toString(36).substr(2, 9), dateObj: new Date(current), dateString: formatDate(current), value: val, completed: false });
      current.setMonth(current.getMonth() + months);
    }
    return dates;
  };

  const hasOverdueItems = (item) => item.dates.some(d => isOverdue(d.dateObj) && !d.completed);

  const sortClaims = (claimsList) => {
    return [...claimsList].sort((a, b) => {
      const aOverdue = hasOverdueItems(a);
      const bOverdue = hasOverdueItems(b);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      const nextDateA = a.dates.find(d => !d.completed)?.dateObj || new Date(8640000000000000);
      const nextDateB = b.dates.find(d => !d.completed)?.dateObj || new Date(8640000000000000);
      return nextDateA - nextDateB;
    });
  };

  const filteredClaims = useMemo(() => {
    if (!searchQuery) return claims;
    return claims.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.note && c.note.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [claims, searchQuery]);

  const filteredIncomes = useMemo(() => {
    if (!searchQuery) return incomes;
    return incomes.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [incomes, searchQuery]);

  const getDynamicColor = (percent, isIncome = false) => {
    if (isIncome) return '#28A745'; 
    if (percent <= 33) return '#28A745'; 
    if (percent <= 67) return '#FF9500'; 
    return '#DC3545'; 
  };

  const saveEntry = () => {
    const parsedStart = parseDate(startDate);
    const parsedEnd = parseDate(endDate);
    const cleanAmount = amount.replace(',', '.');
    if (!name || !amount || !parsedStart) {
      Alert.alert("Fehler", "Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    const currentInterval = activeTab === 'income' ? 0 : interval;
    const newEntry = {
      id: Date.now().toString(),
      name,
      amount: parseFloat(cleanAmount).toFixed(2),
      note, 
      interval: currentInterval === 0 ? 'Einmalig' : (currentInterval === 1 ? 'Monatlich' : `Alle ${currentInterval} Monate`),
      dates: calculateRangeDates(startDate, activeTab === 'income' ? startDate : endDate, currentInterval, parseFloat(cleanAmount).toFixed(2))
    };
    if (activeTab === 'add') {
      const updatedClaims = sortClaims([newEntry, ...claims]);
      setClaims(updatedClaims);
      saveData(updatedClaims, incomes);
    } else {
      const updatedIncomes = [newEntry, ...incomes];
      setIncomes(updatedIncomes);
      saveData(claims, updatedIncomes);
    }
    setName(''); setAmount(''); setStartDate(''); setEndDate(''); setNote(''); 
    setActiveTab('list');
  };

  // --- EINZELBETRAG BEARBEITUNGSLOGIK ---
  const openEditModal = (parentId, dateId, currentValue, type) => {
    setEditingParams({ parentId, dateId, type });
    setEditValue(currentValue.toString());
    setEditModalVisible(true);
  };

  const confirmEdit = () => {
    const { parentId, dateId, type } = editingParams;
    const cleanVal = editValue.replace(',', '.');
    if (isNaN(cleanVal) || cleanVal === '') return;
    const formattedVal = parseFloat(cleanVal).toFixed(2);

    if (type === 'claim') {
      const updated = claims.map(c => {
        if (c.id === parentId) {
          return { ...c, dates: c.dates.map(d => d.id === dateId ? { ...d, value: formattedVal } : d) };
        }
        return c;
      });
      setClaims(updated);
      saveData(updated, incomes);
    } else {
      const updated = incomes.map(i => {
        if (i.id === parentId) {
          return { ...i, dates: i.dates.map(d => d.id === dateId ? { ...d, value: formattedVal } : d) };
        }
        return i;
      });
      setIncomes(updated);
      saveData(claims, updated);
    }
    setEditModalVisible(false);
  };

  const deleteWholeClaim = (id) => {
    Alert.alert("Löschen", "Gesamte Forderung entfernen?", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: () => {
        const updated = claims.filter(c => c.id !== id);
        setClaims(updated);
        saveData(updated, incomes);
      }}
    ]);
  };

  const deleteIncome = (id) => {
    Alert.alert("Löschen", "Einnahme entfernen?", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: () => {
        const updated = incomes.filter(i => i.id !== id);
        setIncomes(updated);
        saveData(claims, updated);
      }}
    ]);
  };

  const toggleDateStatus = (claimId, dateId) => {
    const updated = claims.map(c => {
      if (c.id === claimId) {
        return { ...c, dates: c.dates.map(d => d.id === dateId ? { ...d, completed: !d.completed } : d) };
      }
      return c;
    });
    const sorted = sortClaims(updated);
    setClaims(sorted);
    saveData(sorted, incomes);
  };

  const currentMonthSum = useMemo(() => {
    const now = new Date();
    let totalMonthlyAverage = 0;
    claims.forEach(c => {
      if (!c.dates || c.dates.length === 0) return;
      const hasDateInCurrentMonth = c.dates.some(d => d.dateObj.getMonth() === now.getMonth() && d.dateObj.getFullYear() === now.getFullYear());
      if (hasDateInCurrentMonth) {
        const totalClaimValue = c.dates.reduce((sum, d) => sum + parseFloat(d.value), 0);
        const start = c.dates[0].dateObj;
        const end = c.dates[c.dates.length - 1].dateObj;
        const diffMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
        totalMonthlyAverage += (c.interval === 'Einmalig') ? totalClaimValue : (totalClaimValue / diffMonths);
      }
    });
    return totalMonthlyAverage.toFixed(2);
  }, [claims]);

  const currentMonthIncomeSum = useMemo(() => {
    const now = new Date();
    let totalMonthlyAverage = 0;
    incomes.forEach(i => {
      if (!i.dates || i.dates.length === 0) return;
      const hasDateInCurrentMonth = i.dates.some(d => d.dateObj.getMonth() === now.getMonth() && d.dateObj.getFullYear() === now.getFullYear());
      if (hasDateInCurrentMonth) {
        const totalIncomeValue = i.dates.reduce((sum, d) => sum + parseFloat(d.value), 0);
        const start = i.dates[0].dateObj;
        const end = i.dates[i.dates.length - 1].dateObj;
        const diffMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
        totalMonthlyAverage += (i.interval === 'Einmalig') ? totalIncomeValue : (totalIncomeValue / diffMonths);
      }
    });
    return totalMonthlyAverage.toFixed(2);
  }, [incomes]);

  const balance = useMemo(() => (parseFloat(currentMonthIncomeSum) - parseFloat(currentMonthSum)).toFixed(2), [currentMonthSum, currentMonthIncomeSum]);

  const yearlyStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let totalYearSum = 0;
    const summary = {};
    claims.forEach(claim => {
      let claimYearSum = 0;
      claim.dates.forEach(d => { if (d.dateObj.getFullYear() === currentYear) claimYearSum += parseFloat(d.value); });
      if (claimYearSum > 0) { summary[claim.name] = (summary[claim.name] || 0) + claimYearSum; totalYearSum += claimYearSum; }
    });
    return Object.keys(summary).map(name => ({ name, sum: summary[name], percent: totalYearSum > 0 ? parseFloat((summary[name] / totalYearSum * 100).toFixed(1)) : 0 })).sort((a, b) => b.sum - a.sum);
  }, [claims]);

  const yearlyIncomeStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let totalYearSum = 0;
    const summary = {};
    incomes.forEach(income => {
      let incomeYearSum = 0;
      income.dates.forEach(d => { if (d.dateObj.getFullYear() === currentYear) incomeYearSum += parseFloat(d.value); });
      if (incomeYearSum > 0) { summary[income.name] = (summary[income.name] || 0) + incomeYearSum; totalYearSum += incomeYearSum; }
    });
    return Object.keys(summary).map(name => ({ name, sum: summary[name], percent: totalYearSum > 0 ? parseFloat((summary[name] / totalYearSum * 100).toFixed(1)) : 0 })).sort((a, b) => b.sum - a.sum);
  }, [incomes]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Editor Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Betrag ändern</Text>
            <TextInput style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]} keyboardType="numeric" value={editValue} onChangeText={setEditValue} autoFocus />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalBtn}>
                <Text style={{ color: theme.subText }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmEdit} style={[styles.modalBtn, styles.modalBtnPrimary]}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Speichern</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[styles.topGradient, isDarkMode && { backgroundColor: '#1C1C1E' }]}>
        <SafeAreaView>
          <TouchableOpacity style={styles.themeToggle} onPress={() => { const newMode = !isDarkMode; setIsDarkMode(newMode); AsyncStorage.setItem('@theme_v1', newMode.toString()); }}>
            <Text style={{fontSize: 20}}>{isDarkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <View style={styles.dashboardHeader}>
            <View style={styles.sideCircleContainer}>
              <Animated.View style={[styles.sideCircle, { borderColor: getDashboardColor(), opacity: pulseAnim }]}>
                <View style={[styles.innerCircleSmall, isDarkMode && { backgroundColor: '#2C2C2E' }]}>
                  <Text style={[styles.smallValue, { color: theme.text }]}>{currentMonthSum}€</Text>
                  <Text style={[styles.subLabel, { color: theme.subText }]}>Ausgaben</Text>
                </View>
              </Animated.View>
            </View>
            <View style={styles.mainCircleContainer}>
              <View style={[styles.outerCircle, { borderColor: parseFloat(balance) >= 0 ? '#28A745' : '#FF3B30', borderWidth: 3 }]}>
                <View style={[styles.innerCircleLarge, isDarkMode && { backgroundColor: '#2C2C2E' }]}>
                  <Text style={[styles.monthValue, { color: parseFloat(balance) >= 0 ? '#28A745' : '#FF3B30' }]}>{balance}€</Text>
                  <Text style={[styles.subLabelBold, { color: theme.subText }]}>BILANZ</Text>
                </View>
              </View>
            </View>
            <View style={styles.sideCircleContainer}>
              <View style={[styles.sideCircle, { borderColor: '#28A745' }]}>
                <View style={[styles.innerCircleSmall, isDarkMode && { backgroundColor: '#2C2C2E' }]}>
                  <Text style={[styles.smallValue, { color: theme.text }]}>{currentMonthIncomeSum}€</Text>
                  <Text style={[styles.subLabel, { color: theme.subText }]}>Einnahmen</Text>
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <View style={styles.contentArea}>
        <View style={[styles.tabBar, { backgroundColor: theme.tabBar }]}>
          <TouchableOpacity style={[styles.tabItem, activeTab === 'add' && styles.tabActive]} onPress={() => setActiveTab('add')}><Text style={[styles.tabText, activeTab === 'add' && styles.tabTextActive]}>Ausgaben</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, activeTab === 'income' && styles.tabActive]} onPress={() => setActiveTab('income')}><Text style={[styles.tabText, activeTab === 'income' && styles.tabTextActive]}>Einnahmen</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, activeTab === 'list' && styles.tabActive]} onPress={() => setActiveTab('list')}><Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>Liste</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, activeTab === 'stats' && styles.tabActive]} onPress={() => setActiveTab('stats')}><Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>Analyse</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, activeTab === 'backup' && styles.tabActive]} onPress={() => setActiveTab('backup')}><Text style={[styles.tabText, activeTab === 'backup' && styles.tabTextActive]}>Backup</Text></TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}>
          {(activeTab === 'add' || activeTab === 'income') && (
            <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionTitle, { color: theme.subText }]}>{activeTab === 'add' ? 'NEUE AUSGABE' : 'NEUE EINNAHME'}</Text>
              <View style={[styles.inputGroup, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <TextInput style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]} placeholder="Name" value={name} onChangeText={setName} placeholderTextColor={theme.subText} />
                <TextInput style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]} placeholder="Betrag (€)" keyboardType="numeric" value={amount} onChangeText={setAmount} placeholderTextColor={theme.subText} />
                <TextInput style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]} placeholder={activeTab === 'income' ? "Einnahmendatum (TT.MM.JJJJ)" : "Start (TT.MM.JJJJ)"} keyboardType="numeric" maxLength={10} value={startDate} onChangeText={(t) => handleDateInput(t, setStartDate, true)} placeholderTextColor={theme.subText} />
                {activeTab === 'add' && interval !== 0 && (
                  <TextInput ref={endDateRef} style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]} placeholder="Ende (TT.MM.JJJJ)" keyboardType="numeric" maxLength={10} value={endDate} onChangeText={(t) => handleDateInput(t, setEndDate)} placeholderTextColor={theme.subText} />
                )}
                <TextInput style={[styles.input, { height: 50, textAlignVertical: 'top', paddingTop: 10, color: theme.text, borderBottomWidth: 0 }]} placeholder="Notizen (optional)" multiline value={note} onChangeText={setNote} placeholderTextColor={theme.subText} />
              </View>
              {activeTab === 'add' && (
                <View style={styles.segmentContainer}>
                  {[0, 1, 3, 6, 12].map((m) => (
                    <TouchableOpacity key={m} style={[styles.segment, { backgroundColor: isDarkMode ? '#2C2C2E' : '#E5E5EA' }, interval === m && (isDarkMode ? { backgroundColor: '#0A84FF' } : styles.segmentActive)]} onPress={() => setInterval(m)}>
                      <Text style={[styles.segmentText, { color: theme.subText }, interval === m && styles.segmentTextActive]}>{m === 0 ? "1X" : `${m}M`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity style={[styles.addBtn, isDarkMode && { backgroundColor: activeTab === 'add' ? '#0A84FF' : '#28A745' }]} onPress={saveEntry}><Text style={styles.addBtnText}>Speichern</Text></TouchableOpacity>
            </ScrollView>
          )}

          {activeTab === 'list' && (
            <View style={{ flex: 1 }}>
              <View style={styles.searchContainer}>
                <TextInput style={[styles.searchInput, { backgroundColor: theme.inputBg, color: theme.text }]} placeholder="Suchen..." value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor={theme.subText} />
              </View>
              <ScrollView>
                {filteredIncomes.map(item => (
                  <View key={item.id} style={[styles.card, { backgroundColor: theme.card, marginHorizontal: 20 }]}>
                    <TouchableOpacity style={styles.cardMain} onLongPress={() => deleteIncome(item.id)}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardName, { color: theme.text }]}>{item.name}</Text>
                        <Text style={[styles.cardSub, { color: theme.subText }]}>{item.dates[0]?.dateString}</Text>
                      </View>
                      <TouchableOpacity onPress={() => openEditModal(item.id, item.dates[0]?.id, item.dates[0]?.value, 'income')}>
                        <Text style={[styles.cardAmount, { color: '#28A745' }]}>+{item.dates[0]?.value} €</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </View>
                ))}
                {filteredClaims.map(item => {
                  const isExpanded = expandedId === item.id;
                  const overdue = hasOverdueItems(item);
                  return (
                    <View key={item.id} style={[styles.card, { backgroundColor: theme.card, marginHorizontal: 20 }]}>
                      <TouchableOpacity style={styles.cardMain} onPress={() => setExpandedId(isExpanded ? null : item.id)} onLongPress={() => deleteWholeClaim(item.id)}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardName, { color: theme.text }]}>{item.name}</Text>
                          <Text style={[styles.cardSub, { color: theme.subText }, overdue && styles.redText]}>Nächster: {item.dates.find(d => !d.completed)?.dateString || "Erledigt"}</Text>
                        </View>
                        <Text style={[styles.cardAmount, { color: '#B22222' }]}>-{item.amount} €</Text>
                      </TouchableOpacity>
                      {isExpanded && (
                        <View style={[styles.details, { backgroundColor: theme.detailBg }]}>
                          {item.dates.map((d) => (
                            <View key={d.id} style={[styles.detailRow, { borderTopColor: theme.border }]}>
                              <TouchableOpacity style={styles.checkArea} onPress={() => toggleDateStatus(item.id, d.id)}>
                                <View style={[styles.checkCircle, d.completed && styles.checkActive, (isOverdue(d.dateObj) && !d.completed) && styles.checkOverdue]} />
                                <Text style={[styles.detailDate, { color: theme.text }, d.completed && styles.strike]}>{d.dateString}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => openEditModal(item.id, d.id, d.value, 'claim')}>
                                <Text style={[styles.detailValue, { color: theme.text }]}>{d.value} €</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {activeTab === 'stats' && (
            <ScrollView style={styles.statsContainer}>
              <Text style={[styles.sectionTitle, { color: theme.subText }]}>JAHRES-STATISTIK {new Date().getFullYear()}</Text>
              
              <Text style={[styles.miniLabel, { color: '#28A745', marginBottom: 15 }]}>EINNAHMEN</Text>
              {yearlyIncomeStats.map((item, index) => {
                const color = getDynamicColor(item.percent, true);
                return (
                  <View key={`inc-${index}`} style={[styles.yearlyCard, { backgroundColor: theme.card }]}>
                    <View style={styles.yearlyInfo}>
                      <Text style={[styles.yearlyName, { color: theme.text }]}>{item.name}</Text>
                      <Text style={[styles.yearlyPercent, { color: color }]}>{item.percent.toFixed(1)}%</Text>
                    </View>
                    <View style={[styles.progressBg, { backgroundColor: isDarkMode ? '#2C2C2E' : '#F0F0F0' }]}>
                      <View style={[styles.progressFill, { width: `${item.percent}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.yearlySumSub, { color: theme.subText }]}>{item.sum.toFixed(2)} € gesamt</Text>
                  </View>
                );
              })}

              <View style={{height: 20}} />

              <Text style={[styles.miniLabel, { color: '#DC3545', marginBottom: 15 }]}>AUSGABEN</Text>
              {yearlyStats.map((item, index) => {
                const color = getDynamicColor(item.percent);
                return (
                  <View key={`exp-${index}`} style={[styles.yearlyCard, { backgroundColor: theme.card }]}>
                    <View style={styles.yearlyInfo}>
                      <Text style={[styles.yearlyName, { color: theme.text }]}>{item.name}</Text>
                      <Text style={[styles.yearlyPercent, { color: color }]}>{item.percent.toFixed(1)}%</Text>
                    </View>
                    <View style={[styles.progressBg, { backgroundColor: isDarkMode ? '#2C2C2E' : '#F0F0F0' }]}>
                      <View style={[styles.progressFill, { width: `${item.percent}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.yearlySumSub, { color: theme.subText }]}>{item.sum.toFixed(2)} € gesamt</Text>
                  </View>
                );
              })}
              <View style={{ height: 100 }} />
            </ScrollView>
          )}

          {activeTab === 'backup' && (
            <ScrollView contentContainerStyle={styles.formContainer}>
              <TouchableOpacity style={styles.addBtn} onPress={handleExport}><Text style={styles.addBtnText}>Daten exportieren</Text></TouchableOpacity>
              <TextInput style={[styles.input, { marginTop: 20, height: 100, color: theme.text }]} placeholder="Backup-Code hier einfügen..." multiline value={importCode} onChangeText={setImportCode} />
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#28A745', marginTop: 10 }]} onPress={handleImport}><Text style={styles.addBtnText}>Backup importieren</Text></TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { backgroundColor: '#0A4DAB', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingBottom: 20 },
  themeToggle: { alignSelf: 'flex-end', marginRight: 25, marginTop: 10 },
  dashboardHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  sideCircleContainer: { alignItems: 'center', width: width * 0.25 },
  sideCircle: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  innerCircleSmall: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  smallValue: { fontSize: 10, fontWeight: 'bold' },
  mainCircleContainer: { alignItems: 'center', width: width * 0.4 },
  outerCircle: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
  innerCircleLarge: { width: 98, height: 98, borderRadius: 49, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  monthValue: { fontSize: 18, fontWeight: '800' },
  subLabel: { fontSize: 8 },
  subLabelBold: { fontSize: 9, fontWeight: 'bold' },
  contentArea: { flex: 1, marginTop: 15 },
  tabBar: { flexDirection: 'row', marginHorizontal: 10, borderRadius: 20, height: 45, marginBottom: 15 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabActive: { backgroundColor: '#0A4DAB', borderRadius: 20 },
  tabText: { fontSize: 9, color: '#8E8E93', fontWeight: 'bold' },
  tabTextActive: { color: '#FFF' },
  formContainer: { padding: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '800', marginBottom: 10 },
  miniLabel: { fontSize: 10, fontWeight: 'bold' },
  inputGroup: { borderRadius: 15, padding: 5, marginBottom: 10, borderWidth: 1 },
  input: { height: 40, paddingHorizontal: 12, fontSize: 14, borderBottomWidth: 1 },
  segmentContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  segment: { paddingVertical: 8, borderRadius: 10, width: '18%', alignItems: 'center' },
  segmentActive: { backgroundColor: '#0A4DAB' },
  segmentText: { fontSize: 11, fontWeight: 'bold' },
  segmentTextActive: { color: '#FFF' },
  addBtn: { backgroundColor: '#0A4DAB', height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  searchContainer: { paddingHorizontal: 20, marginBottom: 5 },
  searchInput: { height: 40, borderRadius: 12, paddingHorizontal: 15 },
  card: { marginBottom: 10, borderRadius: 15, elevation: 2, padding: 12 },
  cardMain: { flexDirection: 'row', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: 'bold' },
  cardSub: { fontSize: 11 },
  cardAmount: { fontSize: 15, fontWeight: 'bold' },
  details: { marginTop: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1 },
  checkArea: { flexDirection: 'row', alignItems: 'center' },
  checkCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, marginRight: 8 },
  checkActive: { backgroundColor: '#28A745', borderColor: '#28A745' },
  checkOverdue: { borderColor: '#FF3B30' },
  detailDate: { fontSize: 13 },
  redText: { color: '#FF3B30' },
  strike: { textDecorationLine: 'line-through', color: '#CCC' },
  statsContainer: { padding: 20 },
  yearlyCard: { borderRadius: 15, padding: 15, marginBottom: 12, elevation: 2 },
  yearlyInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  yearlyName: { fontSize: 15, fontWeight: 'bold' },
  yearlyPercent: { fontSize: 16, fontWeight: 'bold' },
  progressBg: { height: 5, borderRadius: 3, marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  yearlySumSub: { fontSize: 12, textAlign: 'right' },
  detailValue: { fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 20, fontSize: 18, textAlign: 'center' },
  modalButtons: { flexDirection: 'row' },
  modalBtn: { flex: 1, padding: 12, alignItems: 'center' },
  modalBtnPrimary: { backgroundColor: '#0A4DAB', borderRadius: 10 }
});

