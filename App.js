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
  Share
} from 'react-native';

const { width } = Dimensions.get('window');

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false); 
  const [activeTab, setActiveTab] = useState('add');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState(''); 
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState(''); 
  const [interval, setInterval] = useState(1); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [claims, setClaims] = useState([]);
  const [incomes, setIncomes] = useState([]); 
  const [expandedId, setExpandedId] = useState(null);
  const [importCode, setImportCode] = useState('');
  const endDateRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

  const handleExport = async () => {
    try {
      const data = JSON.stringify({ claims, incomes });
      await Share.share({ message: data, title: 'Finanz App Backup' });
    } catch (error) {
      Alert.alert("Fehler", "Export fehlgeschlagen");
    }
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
        setImportCode('');
        Alert.alert("Erfolg", "Backup erfolgreich importiert!");
        setActiveTab('list');
      } else { throw new Error(); }
    } catch (e) {
      Alert.alert("Fehler", "Ungültiger Backup-Code.");
    }
  };

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
    if (currentMonthClaims.some(d => isOverdue(d.dateObj) && !d.completed)) return 'overdue';
    if (currentMonthClaims.every(d => d.completed)) return 'completed';
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
    return claims.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.note && c.note.toLowerCase().includes(searchQuery.toLowerCase())));
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
    const sanitizedAmount = amount.replace(',', '.');
    const numericAmount = parseFloat(sanitizedAmount);

    if (activeTab === 'add') {
      if (!name || isNaN(numericAmount) || !parsedStart || (interval !== 0 && !parsedEnd)) {
        Alert.alert("Fehler", "Bitte alle Pflichtfelder korrekt ausfüllen.");
        return;
      }
    } else {
      if (!name || isNaN(numericAmount) || !parsedStart) {
        Alert.alert("Fehler", "Bitte alle Pflichtfelder korrekt ausfüllen.");
        return;
      }
    }

    const currentInterval = activeTab === 'income' ? 0 : interval;
    const finalValue = numericAmount.toFixed(2);

    const newEntry = {
      id: Date.now().toString(),
      name,
      amount: finalValue,
      note, 
      image: selectedImage,
      interval: currentInterval === 0 ? 'Einmalig' : (currentInterval === 1 ? 'Monatlich' : `Alle ${currentInterval} Monate`),
      dates: calculateRangeDates(startDate, activeTab === 'income' ? startDate : endDate, currentInterval, finalValue)
    };

    if (activeTab === 'add') {
      setClaims(prev => sortClaims([newEntry, ...prev]));
    } else {
      setIncomes(prev => [newEntry, ...prev]);
    }
    setName(''); setAmount(''); setStartDate(''); setEndDate(''); setNote(''); setSelectedImage(null);
    setActiveTab('list');
  };

  const currentMonthSum = useMemo(() => {
    const now = new Date();
    let sum = 0;
    claims.forEach(c => {
      c.dates.forEach(d => {
        if (d.dateObj.getMonth() === now.getMonth() && d.dateObj.getFullYear() === now.getFullYear()) {
          sum += parseFloat(d.value);
        }
      });
    });
    return sum.toFixed(2);
  }, [claims]);

  const currentMonthIncomeSum = useMemo(() => {
    const now = new Date();
    let sum = 0;
    incomes.forEach(i => {
      i.dates.forEach(d => {
        if (d.dateObj.getMonth() === now.getMonth() && d.dateObj.getFullYear() === now.getFullYear()) {
          sum += parseFloat(d.value);
        }
      });
    });
    return sum.toFixed(2);
  }, [incomes]);

  const balance = useMemo(() => (parseFloat(currentMonthIncomeSum) - parseFloat(currentMonthSum)).toFixed(2), [currentMonthSum, currentMonthIncomeSum]);

  const yearlyStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let totalYearSum = 0;
    const summary = {};
    claims.forEach(claim => {
      let claimYearSum = 0;
      claim.dates.forEach(d => { if (d.dateObj.getFullYear() === currentYear) claimYearSum += parseFloat(d.value); });
      if (claimYearSum > 0) {
        summary[claim.name] = (summary[claim.name] || 0) + claimYearSum;
        totalYearSum += claimYearSum;
      }
    });
    return Object.keys(summary).map(name => ({
      name,
      sum: summary[name],
      percent: totalYearSum > 0 ? parseFloat((summary[name] / totalYearSum * 100).toFixed(1)) : 0
    })).sort((a, b) => b.sum - a.sum);
  }, [claims]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View style={[styles.topGradient, isDarkMode && { backgroundColor: '#1C1C1E' }]}>
        <SafeAreaView>
          <TouchableOpacity style={styles.themeToggle} onPress={() => setIsDarkMode(!isDarkMode)}>
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
          {['add', 'income', 'list', 'stats', 'backup'].map(tab => (
            <TouchableOpacity key={tab} style={[styles.tabItem, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          {(activeTab === 'add' || activeTab === 'income') && (
            <ScrollView contentContainerStyle={styles.formContainer}>
              <Text style={[styles.sectionTitle, { color: theme.subText }]}>{activeTab === 'add' ? 'NEUE AUSGABE' : 'NEUE EINNAHME'}</Text>
              <View style={[styles.inputGroup, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <TextInput style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]} placeholder="Name" value={name} onChangeText={setName} placeholderTextColor={theme.subText} />
                <TextInput style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]} placeholder="Betrag (€)" keyboardType="numeric" value={amount} onChangeText={setAmount} placeholderTextColor={theme.subText} />
                <TextInput style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]} placeholder="TT.MM.JJJJ" keyboardType="numeric" value={startDate} onChangeText={(t) => handleDateInput(t, setStartDate, true)} placeholderTextColor={theme.subText} />
                {activeTab === 'add' && interval !== 0 && (
                  <TextInput ref={endDateRef} style={[styles.input, { color: theme.text, borderBottomWidth: 0 }]} placeholder="Ende TT.MM.JJJJ" keyboardType="numeric" value={endDate} onChangeText={(t) => handleDateInput(t, setEndDate)} placeholderTextColor={theme.subText} />
                )}
              </View>
              <TouchableOpacity style={styles.addBtn} onPress={saveEntry}><Text style={styles.addBtnText}>Speichern</Text></TouchableOpacity>
            </ScrollView>
          )}

          {activeTab === 'list' && (
            <ScrollView style={{ paddingHorizontal: 20 }}>
              {filteredClaims.map(item => (
                <View key={item.id} style={[styles.card, { backgroundColor: theme.card }]}>
                  <View style={styles.cardMain}>
                    <Text style={[styles.cardName, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.cardAmount, { color: '#B22222' }]}>-{item.amount} €</Text>
                  </View>
                </View>
              ))}
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
  inputGroup: { borderRadius: 15, padding: 5, marginBottom: 10, borderWidth: 1 },
  input: { height: 40, paddingHorizontal: 12, fontSize: 14, borderBottomWidth: 1 },
  addBtn: { backgroundColor: '#0A4DAB', height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#FFF', fontWeight: 'bold' },
  card: { marginBottom: 10, borderRadius: 15, padding: 12 },
  cardMain: { flexDirection: 'row', justifyContent: 'space-between' },
  cardName: { fontSize: 15, fontWeight: 'bold' },
  cardAmount: { fontSize: 15, fontWeight: 'bold' }
});

