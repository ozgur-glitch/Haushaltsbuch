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
      await Share.share({ message: data, title: 'Haushaltsbuch Backup' });
    } catch (error) {
      Alert.alert("Fehler", "Export fehlgeschlagen");
    }
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importCode);
      if (parsed.claims && parsed.incomes) {
        setClaims(parsed.claims.map(c => ({...c, dates: c.dates.map(d => ({ ...d, dateObj: new Date(d.dateObj) }))})));
        setIncomes(parsed.incomes.map(i => ({...i, dates: i.dates.map(d => ({ ...d, dateObj: new Date(d.dateObj) }))})));
        setImportCode('');
        Alert.alert("Erfolg", "Backup importiert!");
      }
    } catch (e) { Alert.alert("Fehler", "Ungültiger Code."); }
  };

  const handleDateInput = (text, setter, isStart = false) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
    else if (cleaned.length > 4) formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2, 4)}.${cleaned.slice(4, 8)}`;
    setter(formatted);
    if (cleaned.length === 8 && isStart && interval !== 0) endDateRef.current?.focus();
  };

  const formatDate = (date) => `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
  const parseDate = (str) => {
    const parts = str.split('.');
    return parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : null;
  };

  const saveEntry = () => {
    const start = parseDate(startDate);
    if (!name || !amount || !start) return Alert.alert("Fehler", "Name, Betrag und Datum prüfen.");
    
    const newEntry = {
      id: Date.now().toString(),
      name,
      amount: parseFloat(amount).toFixed(2),
      note,
      dates: [{ id: Math.random().toString(), dateObj: start, dateString: formatDate(start), value: amount, completed: false }]
    };

    if (activeTab === 'add') setClaims([newEntry, ...claims]);
    else setIncomes([newEntry, ...incomes]);
    
    setName(''); setAmount(''); setStartDate(''); setNote('');
    setActiveTab('list');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={{ backgroundColor: '#0A4DAB' }}>
        <View style={styles.header}>
            <Text style={{color: '#FFF', fontWeight: 'bold'}}>HAUSHALTSBUCH</Text>
            <TouchableOpacity onPress={() => setIsDarkMode(!isDarkMode)}>
                <Text>{isDarkMode ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={[styles.tabBar, { backgroundColor: theme.tabBar }]}>
        {['add', 'income', 'list', 'stats', 'backup'].map(t => (
          <TouchableOpacity key={t} style={[styles.tabItem, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {(activeTab === 'add' || activeTab === 'income') && (
          <View>
            <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg }]} placeholder="Zweck" value={name} onChangeText={setName} placeholderTextColor={theme.subText} />
            <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg }]} placeholder="Betrag (€)" keyboardType="numeric" value={amount} onChangeText={setAmount} placeholderTextColor={theme.subText} />
            <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg }]} placeholder="Datum (TT.MM.JJJJ)" value={startDate} onChangeText={(t) => handleDateInput(t, setStartDate)} placeholderTextColor={theme.subText} />
            <TouchableOpacity style={styles.saveBtn} onPress={saveEntry}><Text style={{color: '#FFF', fontWeight: 'bold'}}>Speichern</Text></TouchableOpacity>
          </View>
        )}

        {activeTab === 'list' && (
          <View>
            {claims.map(c => (
              <View key={c.id} style={[styles.card, {backgroundColor: theme.card}]}>
                <Text style={{color: theme.text, fontWeight: 'bold'}}>{c.name}</Text>
                <Text style={{color: '#FF3B30'}}>-{c.amount}€</Text>
              </View>
            ))}
            {incomes.map(i => (
              <View key={i.id} style={[styles.card, {backgroundColor: theme.card}]}>
                <Text style={{color: theme.text, fontWeight: 'bold'}}>{i.name}</Text>
                <Text style={{color: '#28A745'}}>+{i.amount}€</Text>
              </View>
            ))}
          </View>
        )}
        
        {activeTab === 'backup' && (
            <View>
                <TouchableOpacity style={styles.saveBtn} onPress={handleExport}><Text style={{color: '#FFF'}}>Exportieren</Text></TouchableOpacity>
                <TextInput style={[styles.input, {marginTop: 20, height: 100, color: theme.text}]} placeholder="Backup-Code hier einfügen" multiline value={importCode} onChangeText={setImportCode} />
                <TouchableOpacity style={[styles.saveBtn, {backgroundColor: '#28A745'}]} onPress={handleImport}><Text style={{color: '#FFF'}}>Importieren</Text></TouchableOpacity>
            </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  tabBar: { flexDirection: 'row', padding: 5, margin: 10, borderRadius: 10 },
  tabItem: { flex: 1, alignItems: 'center', padding: 10 },
  tabActive: { backgroundColor: '#0A4DAB', borderRadius: 8 },
  tabText: { fontSize: 10, fontWeight: 'bold', color: '#888' },
  tabTextActive: { color: '#FFF' },
  input: { padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#DDD' },
  saveBtn: { backgroundColor: '#0A4DAB', padding: 15, borderRadius: 10, alignItems: 'center' },
  card: { padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', elevation: 2 }
});

