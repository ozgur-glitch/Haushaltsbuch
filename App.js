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
// WICHTIG: AsyncStorage muss in der package.json stehen
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function App() {
  // --- STATES ---
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
  const [isLoaded, setIsLoaded] = useState(false); 

  const endDateRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // --- PERSISTENZ (SPEICHERN & LADEN) ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedClaims = await AsyncStorage.getItem('@claims_data');
        const savedIncomes = await AsyncStorage.getItem('@incomes_data');
        const savedTheme = await AsyncStorage.getItem('@theme_pref');

        if (savedClaims) {
          const parsed = JSON.parse(savedClaims);
          const restored = parsed.map(c => ({
            ...c,
            dates: c.dates.map(d => ({ ...d, dateObj: new Date(d.dateObj) }))
          }));
          setClaims(restored);
        }
        if (savedIncomes) {
          const parsedInc = JSON.parse(savedIncomes);
          const restoredInc = parsedInc.map(i => ({
            ...i,
            dates: i.dates.map(d => ({ ...d, dateObj: new Date(d.dateObj) }))
          }));
          setIncomes(restoredInc);
        }
        if (savedTheme) setIsDarkMode(savedTheme === 'dark');
      } catch (e) { console.error("Load Error", e); }
      finally { setIsLoaded(true); }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      const saveData = async () => {
        try {
          await AsyncStorage.setItem('@claims_data', JSON.stringify(claims));
          await AsyncStorage.setItem('@incomes_data', JSON.stringify(incomes));
          await AsyncStorage.setItem('@theme_pref', isDarkMode ? 'dark' : 'light');
        } catch (e) { console.error("Save Error", e); }
      };
      saveData();
    }
  }, [claims, incomes, isDarkMode, isLoaded]);

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
        setImportCode('');
        Alert.alert("Erfolg", "Backup erfolgreich importiert!");
        setActiveTab('list');
      } else { throw new Error(); }
    } catch (e) { Alert.alert("Fehler", "Ungültiger Backup-Code."); }
  };

  // --- HILFSFUNKTIONEN ---
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
      if (isStart && interval !== 0 && activeTab === 'add') endDateRef.current?.focus();
      else Keyboard.dismiss();
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

  // --- BERECHNUNGEN ---
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

  const saveEntry = () => {
    const parsedStart = parseDate(startDate);
    const parsedEnd = parseDate(endDate);
    if (activeTab === 'add') {
        if (!name || !amount || !parsedStart || (interval !== 0 && !parsedEnd)) {
            Alert.alert("Fehler", "Bitte Pflichtfelder ausfüllen."); return;
        }
    } else {
        if (!name || !amount || !parsedStart) {
            Alert.alert("Fehler", "Bitte Pflichtfelder ausfüllen."); return;
        }
    }
    const currentInterval = activeTab === 'income' ? 0 : interval;
    const newEntry = {
      id: Date.now().toString(),
      name, amount: parseFloat(amount).toFixed(2), note, 
      image: selectedImage,
      interval: currentInterval === 0 ? 'Einmalig' : (currentInterval === 1 ? 'Monatlich' : `Alle ${currentInterval} Monate`),
      dates: calculateRangeDates(startDate, activeTab === 'income' ? startDate : endDate, currentInterval, parseFloat(amount).toFixed(2))
    };
    if (activeTab === 'add') {
      setClaims(prev => sortClaims([newEntry, ...prev]));
    } else {
      setIncomes(prev => [newEntry, ...prev]);
    }
    setName(''); setAmount(''); setStartDate(''); setEndDate(''); setNote(''); setSelectedImage(null);
    setActiveTab('list');
  };

  const toggleDateStatus = (claimId, dateId) => {
    setClaims(prev => {
      const updated = prev.map(c => {
        if (c.id === claimId) {
          return { ...c, dates: c.dates.map(d => d.id === dateId ? { ...d, completed: !d.completed } : d) };
        }
        return c;
      });
      return sortClaims(updated);
    });
  };

  // --- SUMMEN ---
  const currentMonthSum = useMemo(() => {
    const now = new Date();
    let sum = 0;
    claims.forEach(c => c.dates.forEach(d => {
      if (d.dateObj.getMonth() === now.getMonth() && d.dateObj.getFullYear() === now.getFullYear()) sum += parseFloat(d.value);
    }));
    return sum.toFixed(2);
  }, [claims]);

  const currentMonthIncomeSum = useMemo(() => {
    const now = new Date();
    let sum = 0;
    incomes.forEach(i => i.dates.forEach(d => {
      if (d.dateObj.getMonth() === now.getMonth() && d.dateObj.getFullYear() === now.getFullYear()) sum += parseFloat(d.value);
    }));
    return sum.toFixed(2);
  }, [incomes]);

  const balance = (parseFloat(currentMonthIncomeSum) - parseFloat(currentMonthSum)).toFixed(2);

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
      name, sum: summary[name],
      percent: totalYearSum > 0 ? parseFloat((summary[name] / totalYearSum * 100).toFixed(1)) : 0
    })).sort((a, b) => b.sum - a.sum);
  }, [claims]);

  const yearlyIncomeStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let totalYearSum = 0;
    const summary = {};
    incomes.forEach(income => {
      let incomeYearSum = 0;
      income.dates.forEach(d => { if (d.dateObj.getFullYear() === currentYear) incomeYearSum += parseFloat(d.value); });
      if (incomeYearSum > 0) {
        summary[income.name] = (summary[income.name] || 0) + incomeYearSum;
        totalYearSum += incomeYearSum;
      }
    });
    return Object.keys(summary).map(name => ({
      name, sum: summary[name],
      percent: totalYearSum > 0 ? parseFloat((summary[name] / totalYearSum * 100).toFixed(1)) : 0
    })).sort((a, b) => b.sum - a.sum);
  }, [incomes]);

  // --- RENDER ---
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />
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
          {['add', 'income', 'list', 'stats', 'backup'].map((t) => (
            <TouchableOpacity key={t} style={[styles.tabItem, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                {t==='add'?'Ausgaben':t==='income'?'Einnahmen':t==='list'?'Liste':t==='stats'?'Analyse':'Backup'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          {(activeTab === 'add' || activeTab === 'income') && (
            <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sectionTitle, { color: theme.subText }]}>{activeTab === 'add' ? 'NEUE AUSGABE' : 'NEUE EINNAHME'}</Text>
              <View style={[styles.inputGroup, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <TextInput style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]} placeholder="Name" value={name} onChangeText={setName} placeholderTextColor={theme.subText} />
                <TextInput style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]} placeholder="Betrag (€)" keyboardType="numeric" value={amount} onChangeText={setAmount} placeholderTextColor={theme.subText} />
                <TextInput style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]} placeholder={activeTab==='income'?"Datum (TT.MM.JJJJ)":"Start (TT.MM.JJJJ)"} keyboardType="numeric" value={startDate} onChangeText={(t) => handleDateInput(t, setStartDate, true)} placeholderTextColor={theme.subText} />
                {activeTab === 'add' && interval !== 0 && (
                  <TextInput ref={endDateRef} style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]} placeholder="Ende (TT.MM.JJJJ)" keyboardType="numeric" value={endDate} onChangeText={(t) => handleDateInput(t, setEndDate)} placeholderTextColor={theme.subText} />
                )}
                <TextInput style={[styles.input, { height: 50, color: theme.text, borderBottomWidth: 0 }]} placeholder="Notizen" multiline value={note} onChangeText={setNote} placeholderTextColor={theme.subText} />
              </View>
              {activeTab === 'add' && (
                <View style={styles.segmentContainer}>
                  {[0, 1, 3, 6, 12].map((m) => (
                    <TouchableOpacity key={m} style={[styles.segment, { backgroundColor: isDarkMode ? '#2C2C2E' : '#E5E5EA' }, interval === m && { backgroundColor: '#0A84FF' }]} onPress={() => setInterval(m)}>
                      <Text style={[styles.segmentText, { color: theme.subText }, interval === m && styles.segmentTextActive]}>{m === 0 ? "1X" : `${m}M`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity style={[styles.addBtn, isDarkMode && { backgroundColor: activeTab==='add'?'#0A84FF':'#28A745' }]} onPress={saveEntry}>
                <Text style={styles.addBtnText}>Speichern</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {activeTab === 'list' && (
            <View style={{ flex: 1 }}>
              <TextInput style={[styles.searchInput, { backgroundColor: theme.inputBg, color: theme.text, margin: 15 }]} placeholder="Suchen..." value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor={theme.subText} />
              <ScrollView>
                <View style={{paddingHorizontal: 20}}>
                {filteredIncomes.map(item => (
                   <View key={item.id} style={[styles.card, { backgroundColor: theme.card }]}>
                      <View style={styles.cardMain}>
                         <View style={[styles.cardIconBox, { backgroundColor: '#E8F5E9' }]}><Text>💰</Text></View>
                         <View style={{flex:1}}><Text style={[styles.cardName,{color:theme.text}]}>{item.name}</Text></View>
                         <Text style={{color: '#28A745', fontWeight:'bold'}}>+{item.amount} €</Text>
                         <TouchableOpacity onPress={() => setIncomes(incomes.filter(i => i.id !== item.id))}><Text>  🗑️</Text></TouchableOpacity>
                      </View>
                   </View>
                ))}
                {filteredClaims.map(item => {
                    const overdue = hasOverdueItems(item);
                    return (
                   <View key={item.id} style={[styles.card, { backgroundColor: theme.card, marginTop: 10 }]}>
                      <TouchableOpacity style={styles.cardMain} onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                         <View style={[styles.cardIconBox, { backgroundColor: overdue ? '#FFF0F0' : '#F0F4FF' }]}><Text>{overdue?'⚠️':'📅'}</Text></View>
                         <View style={{flex:1}}><Text style={[styles.cardName,{color:theme.text}]}>{item.name}</Text></View>
                         <Text style={{color: '#FF3B30', fontWeight:'bold'}}>-{item.amount} €</Text>
                         <TouchableOpacity onPress={() => setClaims(claims.filter(c => c.id !== item.id))}><Text>  🗑️</Text></TouchableOpacity>
                      </TouchableOpacity>
                      {expandedId === item.id && (
                        <View style={{backgroundColor: theme.detailBg, padding:10, borderBottomLeftRadius:15, borderBottomRightRadius:15}}>
                          {item.dates.map(d => (
                            <TouchableOpacity key={d.id} style={styles.detailRow} onPress={() => toggleDateStatus(item.id, d.id)}>
                              <Text style={[styles.detailDate, {color: theme.text}, d.completed && styles.strike]}>{d.dateString}</Text>
                              <Text style={{color: theme.text}}>{d.completed ? '✅' : '⭕'}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                   </View>
                )})}
                </View>
                <View style={{height:100}}/>
              </ScrollView>
            </View>
          )}

          {activeTab === 'stats' && (
            <ScrollView style={{padding: 20}}>
               <Text style={{color: theme.text, fontSize: 18, fontWeight: 'bold', marginBottom: 20}}>Analyse {new Date().getFullYear()}</Text>
               {yearlyStats.map(item => (
                 <View key={item.name} style={{marginBottom: 15}}>
                   <View style={{flexDirection:'row', justifyContent:'space-between'}}><Text style={{color: theme.text}}>{item.name}</Text><Text style={{color: theme.text}}>{item.percent}%</Text></View>
                   <View style={{height: 8, backgroundColor: isDarkMode?'#333':'#EEE', borderRadius: 4, marginTop: 5}}>
                     <View style={{width: `${item.percent}%`, height: 8, backgroundColor: '#FF3B30', borderRadius: 4}} />
                   </View>
                 </View>
               ))}
               <View style={{height: 100}}/>
            </ScrollView>
          )}

          {activeTab === 'backup' && (
            <ScrollView contentContainerStyle={styles.formContainer}>
              <TouchableOpacity style={styles.addBtn} onPress={handleExport}><Text style={styles.addBtnText}>Daten Exportieren</Text></TouchableOpacity>
              <TextInput style={[styles.input, {backgroundColor: theme.inputBg, color: theme.text, height: 100, marginTop: 20, textAlignVertical:'top', padding:10}]} multiline placeholder="Backup-Code hier einfügen" value={importCode} onChangeText={setImportCode} />
              <TouchableOpacity style={[styles.addBtn, {backgroundColor: '#28A745', marginTop: 10}]} onPress={handleImport}><Text style={styles.addBtnText}>Daten Importieren</Text></TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingBottom: 25, backgroundColor: '#0A4DAB' },
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
  input: { height: 40, paddingHorizontal: 12, borderBottomWidth: 1 },
  segmentContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  segment: { paddingVertical: 8, borderRadius: 10, width: '18%', alignItems: 'center' },
  segmentText: { fontSize: 11, fontWeight: 'bold' },
  segmentTextActive: { color: '#FFF' },
  addBtn: { backgroundColor: '#0A4DAB', height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#FFF', fontWeight: 'bold' },
  searchInput: { height: 40, borderRadius: 12, paddingHorizontal: 15 },
  card: { borderRadius: 15, padding: 12, marginBottom: 5, elevation: 2 },
  cardMain: { flexDirection: 'row', alignItems: 'center' },
  cardIconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  cardName: { fontSize: 15, fontWeight: 'bold' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderColor: '#EEE' },
  detailDate: { fontSize: 13 },
  strike: { textDecorationLine: 'line-through', color: '#CCC' }
});

