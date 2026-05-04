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

  // --- PERSISTENZ-LOGIK (Laden & Speichern) ---
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
      } catch (e) {
        console.error("Fehler beim Laden", e);
      } finally {
        setIsLoaded(true);
      }
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
        } catch (e) {
          console.error("Fehler beim Speichern", e);
        }
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
      } else {
        throw new Error();
      }
    } catch (e) {
      Alert.alert("Fehler", "Ungültiger Backup-Code.");
    }
  };

  // --- LOGIK & FORMATIERUNG ---
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
      } else {
        Keyboard.dismiss();
      }
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
    } else {
      pulseAnim.setValue(1);
    }
  }, [dashboardStatus]);

  const getDashboardColor = () => {
    switch (dashboardStatus) {
      case 'overdue': return '#FF3B30';
      case 'completed': return '#28A745';
      case 'pending': return isDarkMode ? '#0A84FF' : '#0A4DAB';
      default: return 'rgba(255,255,255,0.3)';
    }
  };

  const pickImage = () => {
    Alert.alert("Foto hinzufügen", "Image-Picker Simulation.", [
      { text: "Beispiel nutzen", onPress: () => setSelectedImage('https://via.placeholder.com/300x400.png') },
      { text: "Abbrechen", style: "cancel" }
    ]);
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
    
    if (activeTab === 'add') {
      if (!name || !amount || !parsedStart || (interval !== 0 && !parsedEnd)) {
        Alert.alert("Fehler", "Bitte alle Pflichtfelder ausfüllen."); return;
      }
    } else {
      if (!name || !amount || !parsedStart) {
        Alert.alert("Fehler", "Bitte alle Pflichtfelder ausfüllen."); return;
      }
    }

    const currentInterval = activeTab === 'income' ? 0 : interval;
    const newEntry = {
      id: Date.now().toString(),
      name,
      amount: parseFloat(amount).toFixed(2),
      note, 
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

  const deleteWholeClaim = (id) => {
    Alert.alert("Löschen", "Gesamte Forderung entfernen?", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: () => setClaims(prev => prev.filter(c => c.id !== id)) }
    ]);
  };

  const deleteIncome = (id) => {
    Alert.alert("Löschen", "Einnahme entfernen?", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: () => setIncomes(prev => prev.filter(i => i.id !== id)) }
    ]);
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

  // --- SUMMEN-BERECHNUNG ---
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
          {['add', 'income', 'list', 'stats', 'backup'].map((tab) => (
            <TouchableOpacity key={tab} style={[styles.tabItem, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'add' ? 'Ausgaben' : tab === 'income' ? 'Einnahmen' : tab === 'list' ? 'Liste' : tab === 'stats' ? 'Analyse' : 'Backup'}
              </Text>
            </TouchableOpacity>
          ))}
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

              <TouchableOpacity style={[styles.imagePickerBtn, isDarkMode && { backgroundColor: '#2C2C2E', borderColor: '#0A84FF' }]} onPress={pickImage}>
                <Text style={[styles.imagePickerText, isDarkMode && { color: '#0A84FF' }]}>{selectedImage ? "✅ Beleg angehängt" : "📸 Foto hinzufügen"}</Text>
              </TouchableOpacity>
              
              {activeTab === 'add' && (
                <>
                  <Text style={[styles.miniLabel, isDarkMode && { color: '#0A84FF' }]}>INTERVALL</Text>
                  <View style={styles.segmentContainer}>
                    {[0, 1, 3, 6, 12].map((m) => (
                      <TouchableOpacity key={m} style={[styles.segment, { backgroundColor: isDarkMode ? '#2C2C2E' : '#E5E5EA' }, interval === m && (isDarkMode ? { backgroundColor: '#0A84FF' } : styles.segmentActive)]} onPress={() => setInterval(m)}>
                        <Text style={[styles.segmentText, { color: theme.subText }, interval === m && styles.segmentTextActive]}>{m === 0 ? "1X" : `${m}M`}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <TouchableOpacity style={[styles.addBtn, isDarkMode && { backgroundColor: activeTab === 'add' ? '#0A84FF' : '#28A745' }]} onPress={saveEntry}>
                <Text style={styles.addBtnText}>Speichern</Text>
              </TouchableOpacity>
              <View style={{ height: 120 }} />
            </ScrollView>
          )}

          {activeTab === 'list' && (
            <View style={{ flex: 1 }}>
              <View style={styles.searchContainer}>
                <TextInput style={[styles.searchInput, { backgroundColor: theme.inputBg, color: theme.text }]} placeholder="Suchen..." value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor={theme.subText} />
              </View>
              <ScrollView>
                {filteredIncomes.length > 0 && (
                  <View style={{paddingHorizontal: 20, marginBottom: 10}}>
                    <Text style={[styles.sectionTitle, {color: '#28A745'}]}>EINNAHMEN</Text>
                    {filteredIncomes.map(item => (
                      <View key={item.id} style={[styles.card, { backgroundColor: theme.card }]}>
                        <TouchableOpacity style={styles.cardMain} onLongPress={() => deleteIncome(item.id)}>
                           <View style={[styles.cardIconBox, { backgroundColor: '#E8F5E9' }]}><Text style={{fontSize: 20}}>💰</Text></View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.cardName, { color: theme.text }]}>{item.name}</Text>
                            <Text style={[styles.cardSub, { color: theme.subText }]}>{item.dates[0]?.dateString}</Text>
                          </View>
                          <Text style={[styles.cardAmount, { color: '#28A745' }]}>+{item.amount} €</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <View style={{paddingHorizontal: 20}}>
                  <Text style={[styles.sectionTitle, {color: '#B22222'}]}>AUSGABEN / FORDERUNGEN</Text>
                  {filteredClaims.map(item => {
                    const isExpanded = expandedId === item.id;
                    const overdue = hasOverdueItems(item);
                    return (
                      <View key={item.id} style={[styles.card, { backgroundColor: theme.card }]}>
                        <TouchableOpacity style={styles.cardMain} onPress={() => setExpandedId(isExpanded ? null : item.id)} onLongPress={() => deleteWholeClaim(item.id)}>
                          <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? '#2C2C2E' : '#F0F4FF' }, overdue && {backgroundColor: isDarkMode ? '#3D1B1B' : '#FFF0F0'}]}>
                            <Text style={{fontSize: 20}}>{overdue ? '⚠️' : '📅'}</Text>
                          </View>
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
                                  <View style={[styles.checkCircle, { borderColor: isDarkMode ? '#48484A' : '#DDD' }, d.completed && styles.checkActive, (isOverdue(d.dateObj) && !d.completed) && styles.checkOverdue]}>
                                    {d.completed && <Text style={{color: '#FFF', fontSize: 10}}>✓</Text>}
                                  </View>
                                  <Text style={[styles.detailDate, { color: theme.text }, d.completed && styles.strike, (isOverdue(d.dateObj) && !d.completed) && styles.redText]}>{d.dateString}</Text>
                                </TouchableOpacity>
                                <Text style={[styles.detailValue, { color: theme.text }, d.completed && styles.strike]}>{d.value} €</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
                <View style={{height: 100}}/>
              </ScrollView>
            </View>
          )}

          {activeTab === 'stats' && (
            <ScrollView style={styles.statsContainer} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionTitle, { color: theme.subText }]}>JAHRES-STATISTIK {new Date().getFullYear()}</Text>
              <Text style={[styles.miniLabel, { color: '#28A745' }]}>EINNAHMEN</Text>
              {yearlyIncomeStats.map((item, index) => (
                <View key={`inc-${index}`} style={[styles.yearlyCard, { backgroundColor: theme.card }]}>
                  <View style={styles.yearlyInfo}><Text style={[styles.yearlyName, { color: theme.text }]}>{item.name}</Text><Text style={[styles.yearlyPercent, { color: '#28A745' }]}>{item.percent}%</Text></View>
                  <View style={[styles.progressBg, { backgroundColor: isDarkMode ? '#2C2C2E' : '#F0F0F0' }]}><View style={[styles.progressFill, { width: `${item.percent}%`, backgroundColor: '#28A745' }]} /></View>
                </View>
              ))}
              <Text style={[styles.miniLabel, { color: '#DC3545', marginTop: 20 }]}>AUSGABEN</Text>
              {yearlyStats.map((item, index) => (
                <View key={`exp-${index}`} style={[styles.yearlyCard, { backgroundColor: theme.card }]}>
                  <View style={styles.yearlyInfo}><Text style={[styles.yearlyName, { color: theme.text }]}>{item.name}</Text><Text style={[styles.yearlyPercent, { color: getDynamicColor(item.percent) }]}>{item.percent}%</Text></View>
                  <View style={[styles.progressBg, { backgroundColor: isDarkMode ? '#2C2C2E' : '#F0F0F0' }]}><View style={[styles.progressFill, { width: `${item.percent}%`, backgroundColor: getDynamicColor(item.percent) }]} /></View>
                </View>
              ))}
              <View style={{ height: 120 }} />
            </ScrollView>
          )}

          {activeTab === 'backup' && (
            <ScrollView contentContainerStyle={styles.formContainer}>
              <Text style={[styles.sectionTitle, { color: theme.subText }]}>BACKUP & WIEDERHERSTELLUNG</Text>
              <View style={[styles.inputGroup, { backgroundColor: theme.inputBg, borderColor: theme.border, padding: 15 }]}>
                <TouchableOpacity style={[styles.addBtn, { height: 40 }]} onPress={handleExport}><Text style={styles.addBtnText}>Exportieren</Text></TouchableOpacity>
              </View>
              <View style={[styles.inputGroup, { backgroundColor: theme.inputBg, borderColor: theme.border, padding: 15, marginTop: 10 }]}>
                <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top', color: theme.text, backgroundColor: isDarkMode ? '#2C2C2E' : '#F0F0F0', borderRadius: 10, borderBottomWidth: 0 }]} placeholder="Backup-Code hier einfügen..." multiline value={importCode} onChangeText={setImportCode} placeholderTextColor={theme.subText} />
                <TouchableOpacity style={[styles.addBtn, { height: 40, marginTop: 15, backgroundColor: '#28A745' }]} onPress={handleImport}><Text style={styles.addBtnText}>Importieren</Text></TouchableOpacity>
              </View>
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
  themeToggle: { alignSelf: 'flex-end', marginRight: 25, marginTop: 10, padding: 5 },
  dashboardHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  sideCircleContainer: { alignItems: 'center', width: width * 0.25 },
  sideCircle: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  innerCircleSmall: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  smallValue: { fontSize: 10, fontWeight: 'bold' },
  mainCircleContainer: { alignItems: 'center', width: width * 0.4 },
  outerCircle: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
  innerCircleLarge: { width: 98, height: 98, borderRadius: 49, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  monthValue: { fontSize: 18, fontWeight: '800' },
  subLabel: { fontSize: 8, marginTop: 1 },
  subLabelBold: { fontSize: 9, fontWeight: 'bold', marginTop: 2, letterSpacing: 1 },
  contentArea: { flex: 1, marginTop: 15 },
  tabBar: { flexDirection: 'row', marginHorizontal: 10, borderRadius: 20, height: 45, elevation: 8, shadowOpacity: 0.1, shadowRadius: 10, marginBottom: 15 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabActive: { backgroundColor: '#0A4DAB', borderRadius: 20 },
  tabText: { fontSize: 9, color: '#8E8E93', fontWeight: 'bold' },
  tabTextActive: { color: '#FFF' },
  formContainer: { padding: 20, paddingBottom: 50 }, 
  sectionTitle: { fontSize: 11, fontWeight: '800', marginBottom: 10, letterSpacing: 1 },
  miniLabel: { fontSize: 10, fontWeight: 'bold', color: '#0A4DAB', marginBottom: 5, marginLeft: 5 },
  inputGroup: { borderRadius: 15, padding: 5, marginBottom: 10, borderWidth: 1 },
  input: { height: 40, paddingHorizontal: 12, fontSize: 14, borderBottomWidth: 1 },
  imagePickerBtn: { height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#0A4DAB' },
  imagePickerText: { color: '#0A4DAB', fontWeight: 'bold', fontSize: 12 },
  segmentContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  segment: { paddingVertical: 8, borderRadius: 10, width: '18%', alignItems: 'center' },
  segmentActive: { backgroundColor: '#0A4DAB' },
  segmentText: { fontSize: 11, fontWeight: 'bold' },
  segmentTextActive: { color: '#FFF' },
  addBtn: { backgroundColor: '#0A4DAB', height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  searchContainer: { paddingHorizontal: 20, marginBottom: 5 },
  searchInput: { height: 40, borderRadius: 12, paddingHorizontal: 15, fontSize: 13, elevation: 2 },
  card: { marginBottom: 10, borderRadius: 15, shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  cardIconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardName: { fontSize: 15, fontWeight: 'bold' },
  cardSub: { fontSize: 11 },
  redText: { color: '#FF3B30', fontWeight: 'bold' },
  cardAmount: { fontSize: 15, fontWeight: 'bold' },
  details: { padding: 12, borderBottomLeftRadius: 15, borderBottomRightRadius: 15 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1 },
  checkArea: { flexDirection: 'row', alignItems: 'center' },
  checkCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  checkActive: { backgroundColor: '#28A745', borderColor: '#28A745' },
  checkOverdue: { borderColor: '#FF3B30' },
  detailDate: { fontSize: 13 },
  strike: { textDecorationLine: 'line-through', color: '#CCC' },
  statsContainer: { flex: 1, padding: 20 },
  yearlyCard: { borderRadius: 15, padding: 15, marginBottom: 12, elevation: 2 },
  yearlyInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  yearlyName: { fontSize: 15, fontWeight: 'bold' },
  yearlyPercent: { fontSize: 16, fontWeight: 'bold' },
  progressBg: { height: 5, borderRadius: 3, marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  detailValue: { fontSize: 13 }
});

