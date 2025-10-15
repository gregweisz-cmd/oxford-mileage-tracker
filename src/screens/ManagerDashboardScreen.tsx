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
import { PerDiemService } from '../services/perDiemService';
import { PermissionService } from '../services/permissionService';
import { Employee, MileageEntry, Receipt } from '../types';

interface ManagerDashboardScreenProps {
  navigation: any;
}

interface TeamMemberData {
  employee: Employee;
  totalMiles: number;
  totalReceipts: number;
  totalPerDiem: number;
  totalExpenses: number;
  totalHours: number;
  entriesCount: number;
  receiptsCount: number;
}

export default function ManagerDashboardScreen({ navigation }: ManagerDashboardScreenProps) {
  const [currentManager, setCurrentManager] = useState<Employee | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    loadManagerData();
  }, [selectedMonth]);

  const loadManagerData = async () => {
    try {
      setLoading(true);
      
      // Wait a bit for database to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get Jackson Longan as the current manager
      const employees = await DatabaseService.getEmployees();
      let manager = employees.find(emp => emp.name === 'Jackson Longan');
      
      // Check if current user has team dashboard permissions
      if (!manager || !PermissionService.hasTeamDashboardPermissions(manager)) {
        Alert.alert('Access Denied', 'You do not have permission to access Team Dashboard');
        navigation.goBack();
        return;
      }
      
      if (!manager) {
        // Create Jackson Longan as the demo manager
        manager = await DatabaseService.createEmployee({
          name: 'Jackson Longan',
          email: 'jackson.longan@oxfordhouse.org',
          password: 'demo123',
          oxfordHouseId: 'OK-MANAGER',
          position: 'Regional Manager',
          phoneNumber: '+15551234567',
          baseAddress: '425 Pergola St., Yukon, OK 73099',
          costCenters: ['Administrative'],
          selectedCostCenters: ['Administrative']
        });
      }
      
      setCurrentManager(manager);
      
      // Get team members - all employees except the manager
      const allEmployees = await DatabaseService.getEmployees();
      const teamEmployees = allEmployees.filter(emp => 
        emp.id !== manager.id
      );
      
      // Load data for each team member
      const teamData: TeamMemberData[] = [];
      
      for (const employee of teamEmployees) {
        const monthEntries = await DatabaseService.getMileageEntries(
          employee.id,
          selectedMonth.getMonth() + 1,
          selectedMonth.getFullYear()
        );
        
        const monthReceipts = await DatabaseService.getReceipts(
          employee.id,
          selectedMonth.getMonth() + 1,
          selectedMonth.getFullYear()
        );
        
        const totalMiles = monthEntries.reduce((sum, entry) => sum + entry.miles, 0);
        const totalReceipts = monthReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
        const totalHours = monthEntries.reduce((sum, entry) => sum + (entry.hoursWorked || 0), 0);
        
        // Calculate per diem
        const perDiemCalculation = await PerDiemService.calculateMonthlyPerDiem(
          employee.id,
          selectedMonth.getMonth() + 1,
          selectedMonth.getFullYear(),
          monthEntries,
          employee
        );
        
        const expenseBreakdown = PerDiemService.getExpenseBreakdown(
          totalMiles,
          totalReceipts,
          perDiemCalculation.totalPerDiem
        );
        
        teamData.push({
          employee,
          totalMiles,
          totalReceipts,
          totalPerDiem: perDiemCalculation.totalPerDiem,
          totalExpenses: expenseBreakdown.totalExpenses,
          totalHours,
          entriesCount: monthEntries.length,
          receiptsCount: monthReceipts.length
        });
      }
      
      setTeamMembers(teamData.sort((a, b) => b.totalExpenses - a.totalExpenses));
      
    } catch (error) {
      console.error('Error loading manager data:', error);
      Alert.alert('Error', 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setSelectedMonth(newMonth);
  };

  const getTotalTeamExpenses = () => {
    return teamMembers.reduce((sum, member) => sum + member.totalExpenses, 0);
  };

  const getTotalTeamMiles = () => {
    return teamMembers.reduce((sum, member) => sum + member.totalMiles, 0);
  };

  const getTotalTeamHours = () => {
    return teamMembers.reduce((sum, member) => sum + member.totalHours, 0);
  };

  const handleViewEmployeeDetails = (employee: Employee) => {
    // Navigate to employee detail view (would need to create this screen)
    Alert.alert('Employee Details', `Viewing details for ${employee.name}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading team data...</Text>
        <StatusBar style="auto" />
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
        <Text style={styles.headerTitle}>Team Dashboard</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Admin')}>
          <MaterialIcons name="admin-panel-settings" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Manager Info */}
      <View style={styles.managerInfo}>
        <MaterialIcons name="supervisor-account" size={24} color="#2196F3" />
        <View style={styles.managerDetails}>
          <Text style={styles.managerName}>{currentManager?.name}</Text>
          <Text style={styles.managerTitle}>{currentManager?.position}</Text>
          <Text style={styles.managerRegion}>{currentManager?.oxfordHouseId}</Text>
        </View>
      </View>

      {/* Month Navigation */}
      <View style={styles.monthNavigation}>
        <TouchableOpacity onPress={() => navigateMonth('prev')}>
          <MaterialIcons name="chevron-left" size={24} color="#2196F3" />
        </TouchableOpacity>
        
        <Text style={styles.monthTitle}>
          {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        
        <TouchableOpacity onPress={() => navigateMonth('next')}>
          <MaterialIcons name="chevron-right" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {/* Team Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <MaterialIcons name="attach-money" size={24} color="#FF9800" />
          <Text style={styles.summaryValue}>${getTotalTeamExpenses().toFixed(2)}</Text>
          <Text style={styles.summaryLabel}>Team Expenses</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <MaterialIcons name="speed" size={24} color="#4CAF50" />
          <Text style={styles.summaryValue}>{getTotalTeamMiles().toFixed(0)}</Text>
          <Text style={styles.summaryLabel}>Team Miles</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <MaterialIcons name="access-time" size={24} color="#FF5722" />
          <Text style={styles.summaryValue}>{getTotalTeamHours().toFixed(0)}h</Text>
          <Text style={styles.summaryLabel}>Team Hours</Text>
        </View>
      </View>

      {/* Team Members */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Team Members ({teamMembers.length})</Text>
        
        {teamMembers.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="group" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No team members found</Text>
            <Text style={styles.emptyStateSubtext}>
              Team members are determined by cost center/region
            </Text>
          </View>
        ) : (
          teamMembers.map((member) => (
            <TouchableOpacity
              key={member.employee.id}
              style={styles.memberCard}
              onPress={() => handleViewEmployeeDetails(member.employee)}
            >
              <View style={styles.memberHeader}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.employee.name}</Text>
                  <Text style={styles.memberTitle}>{member.employee.position}</Text>
                </View>
                
                <View style={styles.memberExpenses}>
                  <Text style={styles.expenseValue}>${member.totalExpenses.toFixed(2)}</Text>
                  <MaterialIcons name="chevron-right" size={20} color="#999" />
                </View>
              </View>
              
              <View style={styles.memberStats}>
                <View style={styles.statItem}>
                  <MaterialIcons name="speed" size={16} color="#4CAF50" />
                  <Text style={styles.statText}>{member.totalMiles.toFixed(1)} mi</Text>
                </View>
                
                <View style={styles.statItem}>
                  <MaterialIcons name="receipt" size={16} color="#E91E63" />
                  <Text style={styles.statText}>${member.totalReceipts.toFixed(2)}</Text>
                </View>
                
                <View style={styles.statItem}>
                  <MaterialIcons name="restaurant" size={16} color="#9C27B0" />
                  <Text style={styles.statText}>${member.totalPerDiem.toFixed(2)}</Text>
                </View>
                
                <View style={styles.statItem}>
                  <MaterialIcons name="access-time" size={16} color="#FF5722" />
                  <Text style={styles.statText}>{member.totalHours.toFixed(1)}h</Text>
                </View>
              </View>
              
              <View style={styles.memberFooter}>
                <Text style={styles.footerText}>
                  {member.entriesCount} entries • {member.receiptsCount} receipts
                </Text>
              </View>
            </TouchableOpacity>
          ))
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#2196F3',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  managerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  managerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  managerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  managerTitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  managerRegion: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
    marginTop: 2,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  memberCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  memberTitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  memberExpenses: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9800',
    marginRight: 4,
  },
  memberStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  memberFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});
