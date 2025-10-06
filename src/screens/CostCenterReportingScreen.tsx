import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { CostCenterReportingService, CostCenterMonthlyReport, CostCenterReport } from '../services/costCenterReportingService';
import { Employee } from '../types';

interface CostCenterReportingScreenProps {
  navigation: any;
}

export default function CostCenterReportingScreen({ navigation }: CostCenterReportingScreenProps) {
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthlyReport, setMonthlyReport] = useState<CostCenterMonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCostCenter, setSelectedCostCenter] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get current employee
      const employee = await DatabaseService.getCurrentEmployee();
      if (!employee) {
        console.error('❌ CostCenterReportingScreen: No current employee found');
        return;
      }
      setCurrentEmployee(employee);
      
      // Generate cost center report for the month
      const report = await CostCenterReportingService.generateMonthlyCostCenterReport(
        employee.id,
        currentMonth.getMonth() + 1,
        currentMonth.getFullYear()
      );
      
      setMonthlyReport(report);
      
    } catch (error) {
      console.error('❌ CostCenterReportingScreen: Error loading data:', error);
      Alert.alert('Error', 'Failed to load cost center data');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const renderCostCenterCard = (report: CostCenterReport) => {
    const isSelected = selectedCostCenter === report.costCenter;
    
    return (
      <TouchableOpacity
        key={report.costCenter}
        style={[styles.costCenterCard, isSelected && styles.costCenterCardSelected]}
        onPress={() => setSelectedCostCenter(isSelected ? null : report.costCenter)}
      >
        <View style={styles.costCenterHeader}>
          <Text style={styles.costCenterName}>{report.costCenter}</Text>
          <MaterialIcons 
            name={isSelected ? "expand-less" : "expand-more"} 
            size={24} 
            color="#2196F3" 
          />
        </View>
        
        <View style={styles.costCenterStats}>
          <View style={styles.statItem}>
            <MaterialIcons name="access-time" size={16} color="#FF5722" />
            <Text style={styles.statValue}>{report.totalHours.toFixed(1)}h</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialIcons name="speed" size={16} color="#4CAF50" />
            <Text style={styles.statValue}>{report.totalMiles.toFixed(1)}mi</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialIcons name="receipt" size={16} color="#E91E63" />
            <Text style={styles.statValue}>${report.totalReceipts.toFixed(2)}</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialIcons name="attach-money" size={16} color="#FF9800" />
            <Text style={styles.statValue}>${report.totalExpenses.toFixed(2)}</Text>
          </View>
        </View>
        
        {isSelected && (
          <View style={styles.costCenterDetails}>
            <Text style={styles.detailsTitle}>Entry Details:</Text>
            <Text style={styles.detailsText}>
              • {report.entryCounts.mileageEntries} Mileage Entries
            </Text>
            <Text style={styles.detailsText}>
              • {report.entryCounts.receiptEntries} Receipt Entries
            </Text>
            <Text style={styles.detailsText}>
              • {report.entryCounts.timeTrackingEntries} Time Tracking Entries
            </Text>
            <Text style={styles.detailsText}>
              • {report.entryCounts.descriptionEntries} Description Entries
            </Text>
            <Text style={styles.detailsText}>
              • Per Diem: ${report.totalPerDiem.toFixed(2)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cost Center Reports</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text>Loading cost center data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cost Center Reports</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Month Navigation */}
      <View style={styles.monthNavigation}>
        <TouchableOpacity onPress={handlePreviousMonth}>
          <MaterialIcons name="chevron-left" size={24} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.monthText}>{formatDate(currentMonth)}</Text>
        <TouchableOpacity onPress={handleNextMonth}>
          <MaterialIcons name="chevron-right" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {monthlyReport && (
          <>
            {/* Totals Summary */}
            <View style={styles.totalsCard}>
              <Text style={styles.totalsTitle}>Monthly Totals</Text>
              <View style={styles.totalsStats}>
                <View style={styles.totalItem}>
                  <MaterialIcons name="access-time" size={20} color="#FF5722" />
                  <Text style={styles.totalValue}>{monthlyReport.totals.totalHours.toFixed(1)}h</Text>
                  <Text style={styles.totalLabel}>Hours</Text>
                </View>
                <View style={styles.totalItem}>
                  <MaterialIcons name="speed" size={20} color="#4CAF50" />
                  <Text style={styles.totalValue}>{monthlyReport.totals.totalMiles.toFixed(1)}mi</Text>
                  <Text style={styles.totalLabel}>Miles</Text>
                </View>
                <View style={styles.totalItem}>
                  <MaterialIcons name="receipt" size={20} color="#E91E63" />
                  <Text style={styles.totalValue}>${monthlyReport.totals.totalReceipts.toFixed(2)}</Text>
                  <Text style={styles.totalLabel}>Receipts</Text>
                </View>
                <View style={styles.totalItem}>
                  <MaterialIcons name="attach-money" size={20} color="#FF9800" />
                  <Text style={styles.totalValue}>${monthlyReport.totals.totalExpenses.toFixed(2)}</Text>
                  <Text style={styles.totalLabel}>Total</Text>
                </View>
              </View>
            </View>

            {/* Cost Center Reports */}
            <View style={styles.costCentersContainer}>
              <Text style={styles.sectionTitle}>Cost Centers ({monthlyReport.costCenterReports.length})</Text>
              {monthlyReport.costCenterReports.map(renderCostCenterCard)}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 20,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  totalsStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  totalItem: {
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 5,
  },
  totalLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  costCentersContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  costCenterCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  costCenterCardSelected: {
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  costCenterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  costCenterName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  costCenterStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginLeft: 5,
  },
  costCenterDetails: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  detailsText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
});
