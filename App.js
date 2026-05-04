import React, { useState, useRef, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  SafeAreaView, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  StatusBar,
  ScrollView,
  Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('list'); 

  // Form States
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [interval, setInterval] = useState(1); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Data States
  const [claims, setClaims] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const endDateRef = useRef(null);

  // --- BILD-FUNKTIONEN ---
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Fehler", "Zugriff auf Galerie verweigert");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Fehler", "Zugriff auf Kamera verweigert");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleImagePress = () => {
    Alert.alert(
      "Beleg hinzufügen",
      "Wähle eine Quelle aus:",
      [
        { text: "Kamera", onPress: takePhoto },
        { text: "Galerie", onPress: pickImage },
        { text: "Abbrechen", style: "cancel" }
      ]
    );
  };

  // --- LOGIK-FUNKTIONEN ---
  const handleDateInput = (text, setter, isStart = false) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) {
      formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
    } else if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2, 4)}.${cleaned.slice(4, 8)}`;
    }
    setter(formatted);
    if (isStart && cleaned.length === 8 && interval !== 0) {
      endDateRef.current?.focus();
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
    const date = new Date(parts[2], parts[1] - 1, parts[0]);
    return isNaN(date.getTime()) ? null : date;
  };

  const calculateRangeDates = (startStr, endStr, months, val) => {
    let dates = [];
    let current = parseDate(startStr);
    if (!current) return [];

    if (months === 0) {
      dates.push({
        id: Math.random().toString(36).substr(2, 9),
        dateObj: new Date(current),
        dateString: formatDate(current),
        value: val,
        completed: false
      });
      return dates;
    }

    let end = parseDate(endStr);
    if (!end || current > end) return [];

    while (current <= end) {
      dates.push({
        id: Math.random().toString(36).substr(2, 9),
        dateObj: new Date(current),
        dateString: formatDate(current),
        value: val,
        completed: false
      });
      current.setMonth(current.getMonth() + months);
    }
    return dates;
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

  const saveClaim = () => {
    const parsedStart = parseDate(startDate);
    const parsedEnd = parseDate(endDate);
    if (!name || !amount || !parsedStart || (interval !== 0 && !parsedEnd)) {
      Alert.alert("Fehler", "Bitte alle Felder ausfüllen.");
      return;
    }
    const newClaim = {
      id: Date.now().toString(),
      name,
      amount: parseFloat(amount).toFixed(2),
      interval: interval === 0 ? 'Einmalig' : (interval === 1 ? 'Monatlich' : `Alle ${interval} Monate`),
      dates: calculateRangeDates(startDate, endDate, interval, parseFloat(amount).toFixed(2)),
      image: selectedImage
    };
    setClaims(prev => [newClaim, ...prev]);
    setName(''); setAmount(''); setStartDate(''); setEndDate(''); setSelectedImage(null);
  };

  const toggleDateStatus = (claimId, dateId) => {
    setClaims(prev => prev.map(c => {
      if (c.id === claimId) {
        return { ...c, dates: c.dates.map(d => d.id === dateId ? { ...d, completed: !d.completed } : d) };
      }
      return c;
    }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Finanzen</Text>
        </View>

        <View style={styles.topStatsArea}>
          <View style={styles.vibrantCard}>
            <Text style={styles.vibrantLabel}>MONATLICHE AUSGABEN</Text>
            <View style={styles.valueContainer}>
              <Text style={styles.vibrantValue}>{currentMonthSum}</Text>
              <Text style={styles.currencySymbol}>€</Text>
            </View>
          </View>
        </View>

        <FlatList 
          data={claims} 
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
                <View style={styles.divider} />
                <TextInput style={styles.input} placeholder="Betrag (€)" keyboardType="numeric" value={amount} onChangeText={setAmount} />
                <View style={styles.divider} />
                <TextInput style={styles.input} placeholder="Start (TTMMJJJJ)" keyboardType="numeric" maxLength={10} value={startDate} onChangeText={(t) => handleDateInput(t, setStartDate, true)} />
                {interval !== 0 && (
                  <>
                    <View style={styles.divider} />
                    <TextInput ref={endDateRef} style={styles.input} placeholder="Ende (TTMMJJJJ)" keyboardType="numeric" maxLength={10} value={endDate} onChangeText={(t) => handleDateInput(t, setEndDate)} />
                  </>
                )}
              </View>

              <TouchableOpacity style={styles.imagePickerBtn} onPress={handleImagePress}>
                {selectedImage ? (
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Image source={{ uri: selectedImage }} style={{width: 30, height: 30, borderRadius: 5, marginRight: 10}} />
                    <Text style={{color: '#007AFF'}}>✓ Beleg angehängt</Text>
                  </View>
                ) : (
                  <Text style={{color: '#007AFF'}}>📎 Beleg hinzufügen</Text>
                )}
              </TouchableOpacity>

              <View style={styles.segmentContainer}>
                {[0, 1, 3, 6, 12].map((m) => (
                  <TouchableOpacity key={m} style={[styles.segment, interval === m && styles.segmentActive]} onPress={() => setInterval(m)}>
                    <Text style={[styles.segmentText, interval === m && styles.segmentTextActive]}>{m === 0 ? "1X" : `${m}M`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <TouchableOpacity style={styles.highlightAddBtn} onPress={saveClaim}>
                <Text style={styles.highlightAddBtnText}>HINZUFÜGEN</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity style={styles.cardMain} onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardSub}>{item.interval} {item.image ? '• 📎' : ''}</Text>
                </View>
                <Text style={styles.cardAmount}>{item.amount} €</Text>
              </TouchableOpacity>
              {expandedId === item.id && (
                <View style={styles.details}>
                  {item.image && <Image source={{ uri: item.image }} style={styles.fullImage} />}
                  {item.dates.map((d) => (
                    <View key={d.id} style={styles.detailRow}>
                      <TouchableOpacity style={styles.checkArea} onPress={() => toggleDateStatus(item.id, d.id)}>
                        <View style={[styles.checkCircle, d.completed && styles.checkActive]} />
                        <Text style={[styles.detailDate, d.completed && styles.strike]}>{d.dateString}</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { padding: 20, backgroundColor: '#FFF' },
  headerTitle: { fontSize: 34, fontWeight: 'bold' },
  topStatsArea: { padding: 20 },
  vibrantCard: { backgroundColor: '#1C1C1E', borderRadius: 24, padding: 24 },
  vibrantLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' },
  valueContainer: { flexDirection: 'row', alignItems: 'baseline' },
  vibrantValue: { color: '#FFF', fontSize: 48, fontWeight: '900' },
  currencySymbol: { color: '#007AFF', fontSize: 24, marginLeft: 8 },
  formContainer: { padding: 20 },
  inputGroup: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 15 },
  input: { height: 50, paddingHorizontal: 16 },
  divider: { height: 0.5, backgroundColor: '#C6C6C8', marginLeft: 16 },
  imagePickerBtn: { padding: 15, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 15, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#007AFF' },
  segmentContainer: { flexDirection: 'row', backgroundColor: '#E3E3E8', borderRadius: 10, padding: 2, marginBottom: 20 },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: '#FFF' },
  segmentText: { fontSize: 14 },
  segmentTextActive: { fontWeight: 'bold' },
  highlightAddBtn: { backgroundColor: '#007AFF', height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  highlightAddBtnText: { color: '#FFF', fontWeight: 'bold' },
  card: { backgroundColor: '#FFF', borderBottomWidth: 0.5, borderBottomColor: '#C6C6C8' },
  cardMain: { flexDirection: 'row', padding: 16, alignItems: 'center' },
  cardName: { fontSize: 17, fontWeight: 'bold' },
  cardSub: { fontSize: 13, color: '#8E8E93' },
  cardAmount: { fontSize: 17, fontWeight: '600', marginRight: 10 },
  details: { backgroundColor: '#F9F9F9', padding: 16 },
  fullImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 15 },
  detailRow: { flexDirection: 'row', paddingVertical: 8 },
  checkArea: { flexDirection: 'row', alignItems: 'center' },
  checkCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#C6C6C8', marginRight: 10 },
  checkActive: { backgroundColor: '#34C759', borderColor: '#34C759' },
  detailDate: { fontSize: 15 },
  strike: { textDecorationLine: 'line-through', color: '#AAA' }
});

