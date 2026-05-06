import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  SafeAreaView, 
  StatusBar,
  Alert,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

export default function App() {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('Ausgaben');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const savedData = await AsyncStorage.getItem('@transactions');
      if (savedData !== null) {
        setTransactions(JSON.parse(savedData));
      }
    } catch (e) {
      console.error("Fehler beim Laden:", e);
    }
  };

  const saveData = async (newData) => {
    try {
      await AsyncStorage.setItem('@transactions', JSON.stringify(newData));
    } catch (e) {
      console.error("Fehler beim Speichern:", e);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert("Berechtigung erforderlich", "Die App benötigt Zugriff auf deine Fotos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const addTransaction = () => {
    if (!description || !amount) {
      Alert.alert("Fehler", "Bitte Name und Betrag eingeben.");
      return;
    }

    const newTransaction = {
      id: Date.now().toString(),
      description,
      amount: parseFloat(amount).toFixed(2),
      type: activeTab,
      image: selectedImage,
      date: new Date().toLocaleDateString('de-DE'),
    };

    const updatedList = [newTransaction, ...transactions];
    setTransactions(updatedList);
    saveData(updatedList);

    setDescription('');
    setAmount('');
    setSelectedImage(null);
  };

  const deleteTransaction = (id) => {
    const updatedList = transactions.filter(item => item.id !== id);
    setTransactions(updatedList);
    saveData(updatedList);
  };

  const calculateTotal = (type) => {
    return transactions
      .filter(t => t.type === type)
      .reduce((sum, item) => sum + parseFloat(item.amount), 0)
      .toFixed(2);
  };

  const balance = (calculateTotal('Einnahmen') - calculateTotal('Ausgaben')).toFixed(2);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.headerContainer}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryAmount}>{calculateTotal('Ausgaben')}€</Text>
            <Text style={styles.summaryLabel}>Ausgaben</Text>
          </View>
          <View style={styles.balanceCircle}>
            <Text style={styles.balanceAmount}>{balance}€</Text>
            <Text style={styles.balanceLabel}>BILANZ</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryAmount}>{calculateTotal('Einnahmen')}€</Text>
            <Text style={styles.summaryLabel}>Einnahmen</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabBar}>
        {['Ausgaben', 'Einnahmen', 'Liste', 'Analyse', 'Backup'].map((tab) => (
          <TouchableOpacity 
            key={tab} 
            style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'Ausgaben' || activeTab === 'Einnahmen' ? (
        <View style={styles.inputArea}>
          <Text style={styles.inputTitle}>NEUE {activeTab.toUpperCase()}</Text>
          <View style={styles.card}>
            <TextInput style={styles.input} placeholder="Name" value={description} onChangeText={setDescription} />
            <TextInput style={styles.input} placeholder="Betrag (€)" keyboardType="numeric" value={amount} onChangeText={setAmount} />
            
            <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
              <Text style={styles.imageButtonText}>
                {selectedImage ? "📸 Foto ausgewählt" : "📸 Foto hinzufügen"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveButton} onPress={addTransaction}>
              <Text style={styles.saveButtonText}>Speichern</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View>
                <Text style={styles.itemDesc}>{item.description}</Text>
                <Text style={styles.itemDate}>{item.date} - {item.type}</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={[styles.itemAmount, {color: item.type === 'Einnahmen' ? '#4CAF50' : '#F44336'}]}>
                  {item.type === 'Einnahmen' ? '+' : '-'}{item.amount} €
                </Text>
                {item.image && <Ionicons name="image" size={20} color="#0A4DAB" style={{marginRight: 10}} />}
                <TouchableOpacity onPress={() => deleteTransaction(item.id)}>
                  <Ionicons name="trash-outline" size={22} color="#FF5252" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={{padding: 20}}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  headerContainer: { backgroundColor: '#0A4DAB', padding: 30, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, alignItems: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between' },
  summaryBox: { alignItems: 'center' },
  summaryAmount: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  summaryLabel: { color: '#BDC3C7', fontSize: 10 },
  balanceCircle: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderColor: '#4CAF50', backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  balanceAmount: { color: '#4CAF50', fontWeight: 'bold', fontSize: 18 },
  balanceLabel: { color: '#7F8C8D', fontSize: 10 },
  tabBar: { flexDirection: 'row', backgroundColor: 'white', margin: 15, borderRadius: 25, padding: 5, elevation: 2 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  activeTabItem: { backgroundColor: '#0A4DAB', borderRadius: 20 },
  tabText: { fontSize: 11, color: '#7F8C8D' },
  activeTabText: { color: 'white', fontWeight: 'bold' },
  inputArea: { padding: 20 },
  inputTitle: { fontSize: 14, fontWeight: 'bold', color: '#95A5A6', marginBottom: 10 },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 20, elevation: 3 },
  input: { borderBottomWidth: 1, borderBottomColor: '#ECF0F1', paddingVertical: 10, marginBottom: 20 },
  imageButton: { borderStyle: 'dashed', borderWidth: 1, borderColor: '#0A4DAB', borderRadius: 10, padding: 15, alignItems: 'center', marginBottom: 20 },
  imageButtonText: { color: '#0A4DAB', fontWeight: '600' },
  saveButton: { backgroundColor: '#0A4DAB', padding: 15, borderRadius: 15, alignItems: 'center' },
  saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  itemCard: { backgroundColor: 'white', padding: 15, borderRadius: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  itemDesc: { fontWeight: 'bold', fontSize: 16 },
  itemDate: { fontSize: 12, color: '#95A5A6' },
  itemRight: { flexDirection: 'row', alignItems: 'center' },
  itemAmount: { fontWeight: 'bold', fontSize: 16, marginRight: 10 }
});

