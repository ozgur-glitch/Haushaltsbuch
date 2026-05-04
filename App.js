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
  // --- STATES (DEINE STRUKTUR) ---
  const [activeTab, setActiveTab] = useState('list'); 
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [interval, setInterval] = useState(1); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [claims, setClaims] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const endDateRef = useRef(null);

  // --- BILD-LOGIK (ECHTE FUNKTION) ---
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Fehler", "Kein Zugriff auf Galerie");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true, aspect: [4, 3], quality: 0.7,
    });
    if (!result.canceled) setSelectedImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Fehler", "Kein Zugriff auf Kamera");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [4, 3], quality: 0.7,
    });
    if (!result.canceled) setSelectedImage(result.assets[0].uri);
  };

  const handleImagePress = () => {
    Alert.alert("Beleg", "Quelle wählen:", [
      { text: "Kamera", onPress: takePhoto },
      { text: "Galerie", onPress: pickImage },
      { text: "Abbrechen", style: "cancel" }
    ]);
  };

  // --- DATUMS-LOGIK (DEINE FUNKTIONEN) ---
  const handleDateInput = (text, setter, isStart = false) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) {
      formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
    } else if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2, 4)}.${cleaned.slice(4, 8)}`;
    }
    setter(formatted);
    if (isStart && cleaned.length === 8 && interval !== 0) endDateRef.current?.focus();
  };

  const formatDate = (date) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}.${m}.${date.getFullYear()}`;
  };

  const parseDate = (str) => {
    if (!str) return null;
    const parts = str.split('.');
    if (parts.length !== 3) return null;
    const date = new Date(parts[2], parts[1] - 1, parts[0]);
    return isNaN(date.getTime()) ? null : date;
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
        if (d.dateObj.getMonth() === now.getMonth() && d.dateObj.getFullYear() === now.getFullYear()) {
          sum += parseFloat(d.value);
        }
      });
    });
    return sum.toFixed(2);
  }, [claims]);

  const saveClaim = () => {
    const parsedStart = parseDate(startDate);
    if (!name || !amount || !parsedStart) {
      Alert.alert("Fehler", "Bitte Name, Betrag und Startdatum prüfen.");
      return;
    }
    const newClaim = {
      id: Date.now().toString(),
      name,
      amount: parseFloat(amount).toFixed(2),
      interval: interval === 0 ? '1X' : `${interval}M`,
      dates: calculateRangeDates(startDate, endDate, interval, parseFloat(amount).toFixed(2)),
      image: selectedImage
    };
    setClaims([newClaim, ...claims]);
    setName(''); setAmount(''); setStartDate(''); setEndDate(''); setSelectedImage(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={styles.header}><Text style={styles.title}>Finanzen</Text></View>
        <View style={styles.vibrantCard}>
          <Text style={styles.label}>AUSGABEN DIESER MONAT</Text>
          <Text style={styles.value}>{currentMonthSum} €</Text>
        </View>

        <FlatList 
          data={claims} 
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.form}>
              <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Betrag (€)" keyboardType="numeric" value={amount} onChangeText={setAmount} />
              <TextInput style={styles.input} placeholder="Start (TTMMJJJJ)" keyboardType="numeric" value={startDate} onChangeText={(t) => handleDateInput(t, setStartDate, true)} />
              {interval !== 0 && <TextInput ref={endDateRef} style={styles.input} placeholder="Ende (TTMMJJJJ)" keyboardType="numeric" value={endDate} onChangeText={(t) => handleDateInput(t, setEndDate)} />}
              
              <TouchableOpacity style={styles.imageBtn} onPress={handleImagePress}>
                <Text style={{color: '#007AFF'}}>{selectedImage ? "✅ Beleg bereit" : "📸 Beleg hinzufügen"}</Text>
              </TouchableOpacity>

              <View style={styles.row}>
                {[0, 1, 3, 6, 12].map(m => (
                  <TouchableOpacity key={m} style={[styles.seg, interval === m && styles.segA]} onPress={() => setInterval(m)}>
                    <Text>{m === 0 ? "1X" : `${m}M`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.addBtn} onPress={saveClaim}><Text style={{color: '#FFF', fontWeight: 'bold'}}>HINZUFÜGEN</Text></TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity onPress={() => setExpandedId(expandedId === item.id ? null : item.id)} style={styles.cardHeader}>
                <Text style={{fontWeight: 'bold'}}>{item.name}</Text>
                <Text>{item.amount} €</Text>
              </TouchableOpacity>
              {expandedId === item.id && (
                <View style={styles.cardDetail}>
                  {item.image && <Image source={{ uri: item.image }} style={styles.img} />}
                  {item.dates.map(d => <Text key={d.id}>{d.dateString}</Text>)}
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
  header: { padding: 20 },
  title: { fontSize: 30, fontWeight: 'bold' },
  vibrantCard: { backgroundColor: '#1C1C1E', margin: 20, padding: 20, borderRadius: 20 },
  label: { color: '#AAA', fontSize: 10 },
  value: { color: '#FFF', fontSize: 36, fontWeight: '900' },
  form: { padding: 20 },
  input: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 10 },
  imageBtn: { padding: 15, backgroundColor: '#FFF', borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#007AFF', alignItems: 'center', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  seg: { padding: 10, backgroundColor: '#DDD', borderRadius: 5, width: 50, alignItems: 'center' },
  segA: { backgroundColor: '#FFF' },
  addBtn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
  card: { backgroundColor: '#FFF', marginHorizontal: 20, marginBottom: 1, padding: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardDetail: { padding: 10, backgroundColor: '#F9F9F9' },
  img: { width: '100%', height: 150, borderRadius: 10, marginTop: 10 }
});

