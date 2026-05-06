import React, { useState, useMemo } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, 
  KeyboardAvoidingView, Platform, StatusBar, ScrollView 
} from 'react-native';
// FIX: Kein ".js" hier!
import * as ImagePicker from 'expo-image-picker';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false); 
  const [activeTab, setActiveTab] = useState('add');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [claims, setClaims] = useState([]);
  const [incomes, setIncomes] = useState([]);

  const theme = {
    bg: isDarkMode ? '#121212' : '#F8F9FF',
    card: isDarkMode ? '#1C1C1E' : '#FFF',
    text: isDarkMode ? '#FFF' : '#333',
    subText: isDarkMode ? '#8E8E93' : '#A0A0A0'
  };

  const balance = useMemo(() => {
    const inc = incomes.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    const exp = claims.reduce((s, c) => s + parseFloat(c.amount || 0), 0);
    return (inc - exp).toFixed(2);
  }, [claims, incomes]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topGradient}>
        <SafeAreaView>
          <TouchableOpacity style={styles.themeToggle} onPress={() => setIsDarkMode(!isDarkMode)}>
            <Text style={{fontSize: 20}}>{isDarkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <View style={styles.dashboardHeader}>
            <View style={[styles.outerCircle, { borderColor: parseFloat(balance) >= 0 ? '#28A745' : '#FF3B30' }]}>
              <View style={[styles.innerCircleLarge, { backgroundColor: theme.card }]}>
                <Text style={[styles.monthValue, { color: parseFloat(balance) >= 0 ? '#28A745' : '#FF3B30' }]}>
                  {balance}€
                </Text>
                <Text style={[styles.subLabelBold, { color: theme.subText }]}>BILANZ</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <View style={styles.contentArea}>
        <View style={[styles.tabBar, { backgroundColor: theme.card }]}>
          {['add', 'income', 'list', 'stats', 'backup'].map(t => (
            <TouchableOpacity key={t} style={[styles.tabItem, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabText, activeTab === t && {color: '#FFF'}]}>{t.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          {(activeTab === 'add' || activeTab === 'income') && (
            <ScrollView contentContainerStyle={styles.formContainer}>
              <View style={[styles.inputGroup, { backgroundColor: theme.card, borderColor: '#EEE', borderWidth: 1 }]}>
                {/* FIX: Tags korrekt mit /> geschlossen */}
                <TextInput 
                  style={[styles.input, { color: theme.text }]} 
                  placeholder="Name" 
                  value={name} 
                  onChangeText={setName} 
                  placeholderTextColor={theme.subText} 
                />
                <TextInput 
                  style={[styles.input, { color: theme.text }]} 
                  placeholder="Betrag (€)" 
                  keyboardType="numeric" 
                  value={amount} 
                  onChangeText={setAmount} 
                  placeholderTextColor={theme.subText} 
                />
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
  topGradient: { backgroundColor: '#0A4DAB', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingBottom: 25 },
  themeToggle: { alignSelf: 'flex-end', marginRight: 25, marginTop: 10 },
  dashboardHeader: { alignItems: 'center' },
  outerCircle: { width: 130, height: 130, borderRadius: 65, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  innerCircleLarge: { width: 115, height: 115, borderRadius: 57.5, justifyContent: 'center', alignItems: 'center' },
  monthValue: { fontSize: 22, fontWeight: '800' },
  subLabelBold: { fontSize: 10, fontWeight: 'bold' },
  contentArea: { flex: 1, marginTop: 20 },
  tabBar: { flexDirection: 'row', marginHorizontal: 15, borderRadius: 25, height: 50 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabActive: { backgroundColor: '#0A4DAB', borderRadius: 25 },
  tabText: { fontSize: 10, color: '#8E8E93', fontWeight: 'bold' },
  formContainer: { padding: 20 },
  inputGroup: { borderRadius: 20, padding: 15 },
  input: { height: 50, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }
});

