import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { PermissionService } from '../services/permissionService';
import { PerDiemRulesService, PerDiemRule } from '../services/perDiemRulesService';
import EesRulesService, { EesRule } from '../services/eesRulesService';
import { Employee } from '../types';
import { COST_CENTERS } from '../constants/costCenters';

interface AdminScreenProps {
  navigation: any;
}

interface EmployeeWithHierarchy extends Employee {
  reportsTo?: string;
  directReports?: EmployeeWithHierarchy[];
  level?: number;
}

export default function AdminScreen({ navigation }: AdminScreenProps) {
  const [employees, setEmployees] = useState<EmployeeWithHierarchy[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithHierarchy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('All');
  const [selectedState, setSelectedState] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithHierarchy | null>(null);
  const [editCostCenter, setEditCostCenter] = useState('');
  const [editPosition, setEditPosition] = useState('');
  
  // Per Diem Rules state
  const [showPerDiemModal, setShowPerDiemModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PerDiemRule | null>(null);
  const [perDiemRules, setPerDiemRules] = useState<PerDiemRule[]>([]);
  const [ruleForm, setRuleForm] = useState({
    costCenter: '',
    maxAmount: '35',
    minHours: '8',
    minMiles: '100',
    minDistanceFromBase: '50',
    description: ''
  });

  // EES Rules state
  const [showEesModal, setShowEesModal] = useState(false);
  const [editingEesRule, setEditingEesRule] = useState<EesRule | null>(null);
  const [eesRules, setEesRules] = useState<EesRule[]>([]);
  const [eesRuleForm, setEesRuleForm] = useState({
    costCenter: '',
    maxAmount: '600',
    description: ''
  });

  useEffect(() => {
    loadEmployees();
    loadPerDiemRules();
    loadEesRules();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [employees, selectedCostCenter, selectedState, searchQuery]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      
      // Check if current user has admin permissions
      const employees = await DatabaseService.getEmployees();
      const currentUser = employees.find(emp => emp.name === 'Jackson Longan'); // Demo user
      
      if (!currentUser || !PermissionService.hasAdminPermissions(currentUser)) {
        Alert.alert('Access Denied', 'You do not have permission to access Employee Management');
        navigation.goBack();
        return;
      }
      
      // Build hierarchy based on titles and cost centers
      const employeesWithHierarchy = buildHierarchy(employees);
      setEmployees(employeesWithHierarchy);
      
    } catch (error) {
      console.error('Error loading employees:', error);
      Alert.alert('Error', 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const buildHierarchy = (allEmployees: Employee[]): EmployeeWithHierarchy[] => {
    // Define hierarchy based on titles
    const hierarchyLevels = {
      'Co-Founder/Consultant': 1,
      'Chief Financial Officer': 1,
      'Director': 2,
      'Senior Manager': 2,
      'Regional Manager': 3,
      'Senior Outreach': 3,
      'Manager': 3,
      'Coordinator': 4,
      'Specialist': 4,
      'Analyst': 4,
      'Assistant': 5,
      'Worker': 5,
    };

    return allEmployees.map(emp => {
      const level = Object.entries(hierarchyLevels).find(([title]) => 
        emp.position.toLowerCase().includes(title.toLowerCase())
      )?.[1] || 6;

      return {
        ...emp,
        level,
        directReports: [],
        reportsTo: undefined
      };
    }).sort((a, b) => a.level - b.level);
  };

  const filterEmployees = () => {
    let filtered = employees;

    // Filter by cost center
    if (selectedCostCenter !== 'All') {
      filtered = filtered.filter(emp => emp.oxfordHouseId.includes(selectedCostCenter));
    }

    // Filter by state
    if (selectedState !== 'All') {
      filtered = filtered.filter(emp => emp.oxfordHouseId.includes(selectedState));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(emp => 
        emp.name.toLowerCase().includes(query) ||
        emp.position.toLowerCase().includes(query) ||
        emp.email.toLowerCase().includes(query)
      );
    }

    setFilteredEmployees(filtered);
  };

  const getCostCenters = () => {
    const costCenters = new Set<string>();
    employees.forEach(emp => {
      // Extract cost center from oxfordHouseId
      const parts = emp.oxfordHouseId.split('-');
      if (parts.length > 0) {
        costCenters.add(parts[0]);
      }
    });
    return ['All', ...Array.from(costCenters).sort()];
  };

  const getStates = () => {
    const states = new Set<string>();
    employees.forEach(emp => {
      // Extract state from oxfordHouseId
      const parts = emp.oxfordHouseId.split('-');
      if (parts.length > 0) {
        states.add(parts[0]);
      }
    });
    return ['All', ...Array.from(states).sort()];
  };

  const handleEditEmployee = (employee: EmployeeWithHierarchy) => {
    setEditingEmployee(employee);
    setEditCostCenter(employee.costCenters?.[0] || '');
    setEditPosition(employee.position);
    setShowEditModal(true);
  };

  const handleSaveEmployee = async () => {
    if (!editingEmployee) return;

    if (!editCostCenter.trim()) {
      Alert.alert('Error', 'Please select a cost center');
      return;
    }

    if (!editPosition.trim()) {
      Alert.alert('Error', 'Please enter a position');
      return;
    }

    try {
      await DatabaseService.updateEmployee(editingEmployee.id, {
        costCenters: [editCostCenter.trim()],
        position: editPosition.trim()
      });

      Alert.alert('Success', 'Employee updated successfully');
      setShowEditModal(false);
      setEditingEmployee(null);
      setEditCostCenter('');
      setEditPosition('');
      loadEmployees();
    } catch (error) {
      console.error('Error updating employee:', error);
      Alert.alert('Error', 'Failed to update employee');
    }
  };

  // Per Diem Rules functions
  const loadPerDiemRules = () => {
    const rules = PerDiemRulesService.getAllRules();
    setPerDiemRules(rules);
  };

  const openPerDiemModal = (rule?: PerDiemRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleForm({
        costCenter: rule.costCenter,
        maxAmount: rule.maxAmount.toString(),
        minHours: rule.minHours.toString(),
        minMiles: rule.minMiles.toString(),
        minDistanceFromBase: rule.minDistanceFromBase.toString(),
        description: rule.description
      });
    } else {
      setEditingRule(null);
      setRuleForm({
        costCenter: '',
        maxAmount: '35',
        minHours: '8',
        minMiles: '100',
        minDistanceFromBase: '50',
        description: ''
      });
    }
    setShowPerDiemModal(true);
  };

  const handleSavePerDiemRule = () => {
    if (!ruleForm.costCenter.trim()) {
      Alert.alert('Error', 'Please enter a cost center');
      return;
    }

    if (!ruleForm.description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    const rule: Partial<PerDiemRule> = {
      costCenter: ruleForm.costCenter.trim(),
      maxAmount: parseFloat(ruleForm.maxAmount),
      minHours: parseFloat(ruleForm.minHours),
      minMiles: parseFloat(ruleForm.minMiles),
      minDistanceFromBase: parseFloat(ruleForm.minDistanceFromBase),
      description: ruleForm.description.trim()
    };

    PerDiemRulesService.updateRule(ruleForm.costCenter.trim(), rule);
    loadPerDiemRules();
    setShowPerDiemModal(false);
    Alert.alert('Success', 'Per diem rule saved successfully');
  };

  const handleDeletePerDiemRule = (costCenter: string) => {
    Alert.alert(
      'Delete Rule',
      'Are you sure you want to delete this per diem rule?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            PerDiemRulesService.deleteRule(costCenter);
            loadPerDiemRules();
            Alert.alert('Success', 'Per diem rule deleted successfully');
          }
        }
      ]
    );
  };

  // EES Rules functions
  const loadEesRules = () => {
    const rules = EesRulesService.getAllRules();
    setEesRules(rules);
  };

  const openEesModal = (rule?: EesRule) => {
    if (rule) {
      setEditingEesRule(rule);
      setEesRuleForm({
        costCenter: rule.costCenter,
        maxAmount: rule.maxAmount.toString(),
        description: rule.description
      });
    } else {
      setEditingEesRule(null);
      setEesRuleForm({
        costCenter: '',
        maxAmount: '600',
        description: ''
      });
    }
    setShowEesModal(true);
  };

  const handleSaveEesRule = () => {
    if (!eesRuleForm.costCenter.trim()) {
      Alert.alert('Error', 'Please enter a cost center');
      return;
    }

    if (!eesRuleForm.description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    EesRulesService.updateRule(
      eesRuleForm.costCenter.trim(),
      parseFloat(eesRuleForm.maxAmount),
      eesRuleForm.description.trim()
    );
    loadEesRules();
    setShowEesModal(false);
    Alert.alert('Success', 'EES rule saved successfully');
  };

  const handleDeleteEesRule = (costCenter: string) => {
    Alert.alert(
      'Delete Rule',
      'Are you sure you want to delete this EES rule?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            EesRulesService.deleteRule(costCenter);
            loadEesRules();
            Alert.alert('Success', 'EES rule deleted successfully');
          }
        }
      ]
    );
  };

  const getHierarchyIcon = (level: number) => {
    switch (level) {
      case 1: return 'star'; // Executive
      case 2: return 'business'; // Director
      case 3: return 'supervisor-account'; // Manager
      case 4: return 'person'; // Coordinator/Specialist
      case 5: return 'support-agent'; // Assistant/Worker
      default: return 'person';
    }
  };

  const getHierarchyColor = (level: number) => {
    switch (level) {
      case 1: return '#FF5722'; // Executive - Red
      case 2: return '#9C27B0'; // Director - Purple
      case 3: return '#2196F3'; // Manager - Blue
      case 4: return '#4CAF50'; // Coordinator - Green
      case 5: return '#FF9800'; // Assistant - Orange
      default: return '#666';
    }
  };

  const renderEmployeeItem = ({ item }: { item: EmployeeWithHierarchy }) => (
    <View style={styles.employeeCard}>
      <View style={styles.employeeInfo}>
        <View style={styles.employeeHeader}>
          <MaterialIcons 
            name={getHierarchyIcon(item.level || 6)} 
            size={20} 
            color={getHierarchyColor(item.level || 6)} 
          />
          <Text style={styles.employeeName}>{item.name}</Text>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => handleEditEmployee(item)}
          >
            <MaterialIcons name="edit" size={20} color="#2196F3" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.employeeTitle}>{item.position}</Text>
        <Text style={styles.employeeEmail}>{item.email}</Text>
        <Text style={styles.employeeCostCenter}>
          Cost Center: {item.costCenters?.[0] || 'Not Set'}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading employees...</Text>
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
        <Text style={styles.headerTitle}>Employee Management</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Cost Center:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {getCostCenters().map(costCenter => (
              <TouchableOpacity
                key={costCenter}
                style={[
                  styles.filterChip,
                  selectedCostCenter === costCenter && styles.activeFilterChip
                ]}
                onPress={() => setSelectedCostCenter(costCenter)}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedCostCenter === costCenter && styles.activeFilterChipText
                ]}>
                  {costCenter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>State:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {getStates().map(state => (
              <TouchableOpacity
                key={state}
                style={[
                  styles.filterChip,
                  selectedState === state && styles.activeFilterChip
                ]}
                onPress={() => setSelectedState(state)}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedState === state && styles.activeFilterChipText
                ]}>
                  {state}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search employees..."
          placeholderTextColor="#999"
        />
      </View>


      {/* Employee List */}
      <FlatList
        data={filteredEmployees}
        renderItem={renderEmployeeItem}
        keyExtractor={(item) => item.id}
        style={styles.employeeList}
        showsVerticalScrollIndicator={false}
      />

      {/* Rules Management Section */}
      <View style={styles.rulesSection}>
        <Text style={styles.sectionTitle}>Rules Management</Text>
        
        {/* Per Diem Rules */}
        <View style={styles.rulesCard}>
          <View style={styles.rulesHeader}>
            <Text style={styles.rulesTitle}>Per Diem Rules</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => openPerDiemModal()}
            >
              <MaterialIcons name="add" size={20} color="#2196F3" />
              <Text style={styles.addButtonText}>Add Rule</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={perDiemRules}
            renderItem={({ item }) => (
              <View style={styles.ruleItem}>
                <View style={styles.ruleInfo}>
                  <Text style={styles.ruleCostCenter}>{item.costCenter}</Text>
                  <Text style={styles.ruleDetails}>
                    Max: ${item.maxAmount} | Min Hours: {item.minHours} | Min Miles: {item.minMiles}
                  </Text>
                  <Text style={styles.ruleDescription}>{item.description}</Text>
                </View>
                <View style={styles.ruleActions}>
                  <TouchableOpacity
                    style={styles.editRuleButton}
                    onPress={() => openPerDiemModal(item)}
                  >
                    <MaterialIcons name="edit" size={16} color="#2196F3" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteRuleButton}
                    onPress={() => handleDeletePerDiemRule(item.costCenter)}
                  >
                    <MaterialIcons name="delete" size={16} color="#f44336" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            keyExtractor={(item) => item.costCenter}
            style={styles.rulesList}
          />
        </View>

        {/* EES Rules */}
        <View style={styles.rulesCard}>
          <View style={styles.rulesHeader}>
            <Text style={styles.rulesTitle}>EES Rules</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => openEesModal()}
            >
              <MaterialIcons name="add" size={20} color="#2196F3" />
              <Text style={styles.addButtonText}>Add Rule</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={eesRules}
            renderItem={({ item }) => (
              <View style={styles.ruleItem}>
                <View style={styles.ruleInfo}>
                  <Text style={styles.ruleCostCenter}>{item.costCenter}</Text>
                  <Text style={styles.ruleDetails}>
                    Max Amount: ${item.maxAmount}
                  </Text>
                  <Text style={styles.ruleDescription}>{item.description}</Text>
                </View>
                <View style={styles.ruleActions}>
                  <TouchableOpacity
                    style={styles.editRuleButton}
                    onPress={() => openEesModal(item)}
                  >
                    <MaterialIcons name="edit" size={16} color="#2196F3" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteRuleButton}
                    onPress={() => handleDeleteEesRule(item.costCenter)}
                  >
                    <MaterialIcons name="delete" size={16} color="#f44336" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            keyExtractor={(item) => item.costCenter}
            style={styles.rulesList}
          />
        </View>
      </View>

      {/* Edit Employee Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Edit {editingEmployee?.name}
            </Text>
            
            <Text style={styles.fieldLabel}>Position:</Text>
            <TextInput
              style={styles.textInput}
              value={editPosition}
              onChangeText={setEditPosition}
              placeholder="Enter position..."
              placeholderTextColor="#999"
            />
            
            <Text style={styles.fieldLabel}>Cost Center:</Text>
            <ScrollView style={styles.costCenterSelector} nestedScrollEnabled>
              {COST_CENTERS.map((costCenter) => (
                <TouchableOpacity
                  key={costCenter}
                  style={[
                    styles.costCenterOption,
                    editCostCenter === costCenter && styles.costCenterOptionSelected
                  ]}
                  onPress={() => setEditCostCenter(costCenter)}
                >
                  <Text style={[
                    styles.costCenterOptionText,
                    editCostCenter === costCenter && styles.costCenterOptionTextSelected
                  ]}>
                    {costCenter}
                  </Text>
                  {editCostCenter === costCenter && (
                    <MaterialIcons name="check" size={20} color="#2196F3" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={handleSaveEmployee}
              >
                <Text style={styles.modalButtonPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Per Diem Rules Modal */}
      <Modal
        visible={showPerDiemModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPerDiemModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingRule ? 'Edit Per Diem Rule' : 'Add Per Diem Rule'}
            </Text>
            
            <Text style={styles.fieldLabel}>Cost Center:</Text>
            <TextInput
              style={styles.textInput}
              value={ruleForm.costCenter}
              onChangeText={(value) => setRuleForm(prev => ({ ...prev, costCenter: value }))}
              placeholder="Enter cost center..."
              placeholderTextColor="#999"
            />
            
            <Text style={styles.fieldLabel}>Max Amount:</Text>
            <TextInput
              style={styles.textInput}
              value={ruleForm.maxAmount}
              onChangeText={(value) => setRuleForm(prev => ({ ...prev, maxAmount: value }))}
              placeholder="35"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
            
            <Text style={styles.fieldLabel}>Min Hours:</Text>
            <TextInput
              style={styles.textInput}
              value={ruleForm.minHours}
              onChangeText={(value) => setRuleForm(prev => ({ ...prev, minHours: value }))}
              placeholder="8"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
            
            <Text style={styles.fieldLabel}>Min Miles:</Text>
            <TextInput
              style={styles.textInput}
              value={ruleForm.minMiles}
              onChangeText={(value) => setRuleForm(prev => ({ ...prev, minMiles: value }))}
              placeholder="100"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
            
            <Text style={styles.fieldLabel}>Min Distance From Base:</Text>
            <TextInput
              style={styles.textInput}
              value={ruleForm.minDistanceFromBase}
              onChangeText={(value) => setRuleForm(prev => ({ ...prev, minDistanceFromBase: value }))}
              placeholder="50"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
            
            <Text style={styles.fieldLabel}>Description:</Text>
            <TextInput
              style={styles.textInput}
              value={ruleForm.description}
              onChangeText={(value) => setRuleForm(prev => ({ ...prev, description: value }))}
              placeholder="Enter description..."
              placeholderTextColor="#999"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowPerDiemModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={handleSavePerDiemRule}
              >
                <Text style={styles.modalButtonPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* EES Rules Modal */}
      <Modal
        visible={showEesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingEesRule ? 'Edit EES Rule' : 'Add EES Rule'}
            </Text>
            
            <Text style={styles.fieldLabel}>Cost Center:</Text>
            <TextInput
              style={styles.textInput}
              value={eesRuleForm.costCenter}
              onChangeText={(value) => setEesRuleForm(prev => ({ ...prev, costCenter: value }))}
              placeholder="Enter cost center..."
              placeholderTextColor="#999"
            />
            
            <Text style={styles.fieldLabel}>Max Amount:</Text>
            <TextInput
              style={styles.textInput}
              value={eesRuleForm.maxAmount}
              onChangeText={(value) => setEesRuleForm(prev => ({ ...prev, maxAmount: value }))}
              placeholder="600"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
            
            <Text style={styles.fieldLabel}>Description:</Text>
            <TextInput
              style={styles.textInput}
              value={eesRuleForm.description}
              onChangeText={(value) => setEesRuleForm(prev => ({ ...prev, description: value }))}
              placeholder="Enter description..."
              placeholderTextColor="#999"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowEesModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={handleSaveEesRule}
              >
                <Text style={styles.modalButtonPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    flex: 1,
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 24, // Balance the back button
  },
  filtersContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 10,
    minWidth: 80,
  },
  filterChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  activeFilterChip: {
    backgroundColor: '#2196F3',
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
  },
  activeFilterChipText: {
    color: '#fff',
  },
  searchInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    marginTop: 10,
  },
  editButton: {
    padding: 8,
  },
  employeeList: {
    flex: 1,
    padding: 15,
  },
  employeeCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  employeeTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  employeeEmail: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  employeeCostCenter: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  costCenterSelector: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  costCenterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  costCenterOptionSelected: {
    backgroundColor: '#e3f2fd',
  },
  costCenterOptionText: {
    fontSize: 16,
    color: '#333',
  },
  costCenterOptionTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButtonSecondary: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    marginRight: 8,
  },
  modalButtonSecondaryText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalButtonPrimary: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    marginLeft: 8,
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Rules section styles
  rulesSection: {
    backgroundColor: '#fff',
    padding: 15,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  rulesCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  rulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  rulesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  rulesList: {
    maxHeight: 200,
  },
  ruleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  ruleInfo: {
    flex: 1,
  },
  ruleCostCenter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  ruleDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  ruleDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
    fontStyle: 'italic',
  },
  ruleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editRuleButton: {
    padding: 4,
  },
  deleteRuleButton: {
    padding: 4,
  },
});
