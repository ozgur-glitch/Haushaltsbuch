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
  Image // Neu für die Anzeige des Bildes
} from 'react-native'; 
import * as ImagePicker from 'expo-image-picker'; // Echte Kamera-Bibliothek

const { width } = Dimensions.get('window'); 

export default function App() {
  // --- STATES (DEIN ORIGINAL) ---
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

  // --- THEME COLORS (DEIN ORIGINAL) ---
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

  // --- BILD-LOGIK (DIE REPARATUR) ---
  const pickImage = async () => {
    // 1. Berechtigung abfragen
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert("Fehler", "Wir brauchen Zugriff auf deine Fotos.");
      return;
    }

    // 2. Picker öffnen
    Alert.alert("Foto hinzufügen", "Quelle wählen:", [
      {
        text: "Kamera",
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
          });
          if (!result.canceled) setSelectedImage(result.assets[0].uri);
        }
      },
      {
        text: "Galerie",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
          });
          if (!result.canceled) setSelectedImage(result.assets[0].uri);
        }
      },
      { text: "Abbrechen", style: "cancel" }
    ]);
  };

  // --- DEINE ORIGINAL LOGIK (DATUM, STATS, BACKUP) ---
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
          ...c, dates: c.dates.map(d => ({ ...d, dateObj: new Date(d.dateObj) }))
        }));
        const restoredIncomes = parsed.incomes.map(i => ({
          ...i, dates: i.dates.map(d => ({ ...d, dateObj: new Date(d.dateObj) }))
        }));
        setClaims(restoredClaims); setIncomes(restoredIncomes); setImportCode('');
        Alert.alert("Erfolg", "Backup importiert!"); setActiveTab('list');
      }
    } catch (e) { Alert.alert("Fehler", "Code ungültig."); }
  }; 

  const handleDateInput = (text, setter, isStart = false) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
    else if (cleaned.length > 4) formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2, 4)}.${cleaned.slice(4, 8)}`;
    setter(formatted);
    if (cleaned.length === 8) {
      if (isStart && interval !== 0 && activeTab === 'add') endDateRef.current?.focus();
      else Keyboard.dismiss();
    }
  }; 

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}`;
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

  const currentMonthSum = useMemo(() => {
    const now = new Date();
    let sum = 0;
    claims.forEach(c => {
      c.dates.forEach(d => {
        if (d.dateObj.getMonth() === now.getMonth() && d.dateObj.getFullYear() === now.getFullYear()) sum += parseFloat(d.value);
      });
    });
    return sum.toFixed(2);
  }, [claims]);

  const currentMonthIncomeSum = useMemo(() => {
    const now = new Date();
    let sum = 0;
    incomes.forEach(i => {
      i.dates.forEach(d => {
        if (d.dateObj.getMonth() === now.getMonth() && d.dateObj.getFullYear() === now.getFullYear()) sum += parseFloat(d.value);
      });
    });
    return sum.toFixed(2);
  }, [incomes]); 

  const balance = useMemo(() => (parseFloat(currentMonthIncomeSum) - parseFloat(currentMonthSum)).toFixed(2), [currentMonthSum, currentMonthIncomeSum]);

  const saveEntry = () => {
    const parsedStart = parseDate(startDate);
    if (!name || !amount || !parsedStart) {
      Alert.alert("Fehler", "Name, Betrag und Startdatum sind Pflicht.");
      return;
    }
    const currentInterval = activeTab === 'income' ? 0 : interval; 
    const newEntry = {
      id: Date.now().toString(),
      name,
      amount: parseFloat(amount).toFixed(2),
      note, 
      image: selectedImage,
      interval: currentInterval === 0 ? 'Einmalig' : (currentInterval === 1 ? 'Monatlich' : `Alle ${currentInterval} M`),
      dates: calculateRangeDates(startDate, activeTab === 'income' ? startDate : endDate, currentInterval, parseFloat(amount).toFixed(2))
    }; 

    if (activeTab === 'add') setClaims(prev => [newEntry, ...prev]);
    else setIncomes(prev => [newEntry, ...prev]);

    setName(''); setAmount(''); setStartDate(''); setEndDate(''); setNote(''); setSelectedImage(null);
    setActiveTab('list');
  };

  // --- UI RENDERING (DEIN ORIGINAL) ---
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
                <TextInput style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]} placeholder="TT.MM.JJJJ" keyboardType="numeric" maxLength={10} value={startDate} onChangeText={(t) => handleDateInput(t, setStartDate, true)} placeholderTextColor={theme.subText} />
                {activeTab === 'add' && interval !== 0 && (
                  <TextInput ref={endDateRef} style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]} placeholder="Ende TT.MM.JJJJ" keyboardType="numeric" maxLength={10} value={endDate} onChangeText={(t) => handleDateInput(t, setEndDate)} placeholderTextColor={theme.subText} />
                )}
                <TextInput style={[styles.input, { height: 50, borderBottomWidth: 0 }]} placeholder="Notizen" multiline value={note} onChangeText={setNote} placeholderTextColor={theme.subText} />
              </View> 

              <TouchableOpacity style={[styles.imagePickerBtn, isDarkMode && { borderColor: '#0A84FF' }]} onPress={pickImage}>
                <Text style={[styles.imagePickerText, isDarkMode && { color: '#0A84FF' }]}>{selectedImage ? "✅ Beleg gespeichert" : "📸 Foto hinzufügen"}</Text>
              </TouchableOpacity>
              
              {selectedImage && <Image source={{uri: selectedImage}} style={{width: '100%', height: 100, borderRadius: 10, marginBottom: 10}} />}

              {activeTab === 'add' && (
                <View style={styles.segmentContainer}>
                  {[0, 1, 3, 6, 12].map((m) => (
                    <TouchableOpacity key={m} style={[styles.segment, { backgroundColor: isDarkMode ? '#2C2C2E' : '#E5E5EA' }, interval === m && { backgroundColor: '#0A4DAB' }]} onPress={() => setInterval(m)}>
                      <Text style={[styles.segmentText, interval === m && {color: '#FFF'}]}>{m === 0 ? "1X" : `${m}M`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              <TouchableOpacity style={styles.addBtn} onPress={saveEntry}>
                <Text style={styles.addBtnText}>Speichern</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {activeTab === 'list' && (
            <ScrollView>
              {claims.map(item => (
                <View key={item.id} style={[styles.card, { backgroundColor: theme.card, margin: 10, padding: 15 }]}>
                  <Text style={{color: theme.text, fontWeight: 'bold'}}>{item.name}</Text>
                  <Text style={{color: '#FF3B30'}}>-{item.amount} €</Text>
                  {item.image && <Image source={{uri: item.image}} style={{width: 50, height: 50, marginTop: 5}} />}
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
  themeToggle: { alignSelf: 'flex-end', marginRight: 25, marginTop: 10, padding: 5 },
  dashboardHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  sideCircleContainer: { alignItems: 'center', width: width * 0.25 },
  sideCircle: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  innerCircleSmall: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  smallValue: { fontSize: 10, fontWeight: 'bold' },
  mainCircleContainer: { alignItems: 'center', width: width * 0.4 },
  outerCircle: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
  innerCircleLarge: { width: 98, height: 98, borderRadius: 49, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  monthValue: { fontSize: 18, fontWeight: '800' },
  subLabel: { fontSize: 8, marginTop: 1 },
  subLabelBold: { fontSize: 9, fontWeight: 'bold', marginTop: 2, letterSpacing: 1 },
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
  imagePickerBtn: { height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#0A4DAB' },
  imagePickerText: { color: '#0A4DAB', fontWeight: 'bold', fontSize: 12 },
  segmentContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  segment: { paddingVertical: 8, borderRadius: 10, width: '18%', alignItems: 'center' },
  segmentText: { fontSize: 11, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#0A4DAB', height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  card: { borderRadius: 15, elevation: 2 }
});
