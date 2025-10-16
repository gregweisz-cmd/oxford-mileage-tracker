import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { DatabaseService } from '../services/database';
import { PdfService } from '../services/pdfService';
import { Receipt, Employee } from '../types';

interface ReceiptsScreenProps {
  navigation: any;
}

export default function ReceiptsScreen({ navigation }: ReceiptsScreenProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  // Refresh data when screen comes into focus (e.g., after adding a receipt)
  useFocusEffect(
    React.useCallback(() => {
      console.log('📄 ReceiptsScreen: Screen focused, refreshing data');
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get the current logged-in employee instead of the first employee
      const employee = await DatabaseService.getCurrentEmployee();
      
      if (employee) {
        setCurrentEmployee(employee);
        const employeeReceipts = await DatabaseService.getReceipts(employee.id);
        setReceipts(employeeReceipts);
        console.log('📄 ReceiptsScreen: Loaded', employeeReceipts.length, 'receipts for', employee.name);
      } else {
        console.log('📄 ReceiptsScreen: No current employee found');
        setReceipts([]);
      }
    } catch (error) {
      console.error('Error loading receipts:', error);
      Alert.alert('Error', 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyReceiptsPdf = async () => {
    if (!currentEmployee) {
      Alert.alert('Error', 'No employee selected');
      return;
    }

    try {
      console.log('Starting PDF generation for employee:', currentEmployee.name);
      
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      console.log(`Getting receipts for ${month}/${year}`);

      // Get receipts for current month
      const monthlyReceipts = await DatabaseService.getReceipts(
        currentEmployee.id,
        month,
        year
      );

      console.log('Found receipts:', monthlyReceipts.length);

      if (monthlyReceipts.length === 0) {
        Alert.alert('No Data', 'No receipts found for this month');
        return;
      }

      // Validate employee data
      if (!currentEmployee.baseAddress) {
        Alert.alert('Missing Data', 'Employee base address is required for PDF generation. Please update employee profile.');
        return;
      }

      console.log('Generating PDF...');

      // Generate PDF
      const pdfUri = await PdfService.generateMonthlyReceiptsPdf(
        monthlyReceipts,
        currentEmployee,
        month,
        year
      );

      console.log('PDF generated successfully, sharing...');

      // Share PDF
      await PdfService.shareReceiptsPdf(pdfUri, currentEmployee, month, year);

      Alert.alert('Success', 'Monthly receipts PDF generated and shared successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to generate receipts PDF';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const testPdfGeneration = async () => {
    try {
      console.log('Testing PDF generation...');
      const success = await PdfService.testPdfGeneration();
      
      if (success) {
        Alert.alert('Test Success', 'PDF generation is working correctly');
      } else {
        Alert.alert('Test Failed', 'PDF generation is not working. Check device compatibility.');
      }
    } catch (error) {
      console.error('Test PDF generation error:', error);
      Alert.alert('Test Error', `PDF test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const deleteReceipt = (receipt: Receipt) => {
    Alert.alert(
      'Delete Receipt',
      `Are you sure you want to delete this receipt from ${receipt.vendor}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteReceipt(receipt.id);
              Alert.alert('Success', 'Receipt deleted successfully');
              loadData(); // Refresh the list
            } catch (error) {
              console.error('Error deleting receipt:', error);
              Alert.alert('Error', 'Failed to delete receipt');
            }
          },
        },
      ]
    );
  };

  const viewReceiptImage = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setShowImageModal(true);
  };

  const viewReceiptDetails = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setShowDetailsModal(true);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTotalAmount = () => {
    return receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
  };

  const getCategoryTotals = () => {
    return receipts.reduce((totals, receipt) => {
      totals[receipt.category] = (totals[receipt.category] || 0) + receipt.amount;
      return totals;
    }, {} as Record<string, number>);
  };

  // Multi-select functions
  const toggleMultiSelectMode = () => {
    setMultiSelectMode(!multiSelectMode);
    setSelectedReceiptIds(new Set());
  };

  const toggleReceiptSelection = (receiptId: string) => {
    const newSelectedIds = new Set(selectedReceiptIds);
    if (newSelectedIds.has(receiptId)) {
      newSelectedIds.delete(receiptId);
    } else {
      newSelectedIds.add(receiptId);
    }
    setSelectedReceiptIds(newSelectedIds);
  };

  const selectAllReceipts = () => {
    const allIds = new Set(receipts.map(receipt => receipt.id));
    setSelectedReceiptIds(allIds);
  };

  const clearSelection = () => {
    setSelectedReceiptIds(new Set());
  };

  const deleteSelectedReceipts = () => {
    if (selectedReceiptIds.size === 0) {
      Alert.alert('No Selection', 'Please select receipts to delete');
      return;
    }

    const selectedCount = selectedReceiptIds.size;
    Alert.alert(
      'Delete Selected Receipts',
      `Are you sure you want to delete ${selectedCount} receipt${selectedCount > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const deletePromises = Array.from(selectedReceiptIds).map(id => 
                DatabaseService.deleteReceipt(id)
              );
              await Promise.all(deletePromises);
              
              Alert.alert('Success', `${selectedCount} receipt${selectedCount > 1 ? 's' : ''} deleted successfully`);
              setMultiSelectMode(false);
              setSelectedReceiptIds(new Set());
              loadData(); // Refresh the list
            } catch (error) {
              console.error('Error deleting receipts:', error);
              Alert.alert('Error', 'Failed to delete some receipts');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading receipts...</Text>
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
        <Text style={styles.headerTitle}>
          {multiSelectMode ? `Select Receipts (${selectedReceiptIds.size})` : 'Receipts'}
        </Text>
        <View style={styles.headerRight}>
          {multiSelectMode && (
            <>
              <TouchableOpacity onPress={clearSelection} style={styles.headerButton}>
                <MaterialIcons name="clear" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={deleteSelectedReceipts} style={styles.headerButton}>
                <MaterialIcons name="delete" size={24} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialIcons name="receipt" size={24} color="#4CAF50" />
            <Text style={styles.statValue}>{receipts.length}</Text>
            <Text style={styles.statLabel}>Total Receipts</Text>
          </View>
          
          <View style={styles.statCard}>
            <MaterialIcons name="attach-money" size={24} color="#FF9800" />
            <Text style={styles.statValue}>${getTotalAmount().toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Amount</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.addReceiptButton}
            onPress={() => navigation.navigate('AddReceipt')}
          >
            <MaterialIcons name="add-circle" size={24} color="#fff" />
            <Text style={styles.addReceiptButtonText}>Add Receipt</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.generateButton}
            onPress={generateMonthlyReceiptsPdf}
          >
            <MaterialIcons name="picture-as-pdf" size={24} color="#fff" />
            <Text style={styles.generateButtonText}>Generate Monthly PDF</Text>
          </TouchableOpacity>
        </View>

        {/* Category Breakdown */}
        {Object.keys(getCategoryTotals()).length > 0 && (
          <View style={styles.categoryContainer}>
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
            {Object.entries(getCategoryTotals()).map(([category, amount]) => (
              <View key={category} style={styles.categoryItem}>
                <Text style={styles.categoryName}>{category}</Text>
                <Text style={styles.categoryAmount}>${amount.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Multi-select Controls */}
        {receipts.length > 0 && (
          <View style={styles.multiSelectContainer}>
            <View style={styles.multiSelectHeader}>
              <Text style={styles.sectionTitle}>All Receipts</Text>
              <TouchableOpacity
                style={styles.multiSelectButton}
                onPress={toggleMultiSelectMode}
              >
                <MaterialIcons 
                  name={multiSelectMode ? "close" : "checklist"} 
                  size={20} 
                  color="#2196F3" 
                />
                <Text style={styles.multiSelectButtonText}>
                  {multiSelectMode ? 'Cancel' : 'Select'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {multiSelectMode && (
              <View style={styles.multiSelectActions}>
                <TouchableOpacity
                  style={styles.selectAllButton}
                  onPress={selectAllReceipts}
                >
                  <MaterialIcons name="select-all" size={16} color="#2196F3" />
                  <Text style={styles.selectAllButtonText}>Select All</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={clearSelection}
                >
                  <MaterialIcons name="clear" size={16} color="#666" />
                  <Text style={styles.clearAllButtonText}>Clear All</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Receipts List */}
        <View style={styles.receiptsContainer}>
          {!multiSelectMode && <Text style={styles.sectionTitle}>All Receipts</Text>}
          
          {receipts.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="receipt" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No receipts added yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Tap the + button to add your first receipt
              </Text>
            </View>
          ) : (
            receipts.map((receipt) => (
              <View key={receipt.id} style={[
                styles.receiptCard,
                multiSelectMode && selectedReceiptIds.has(receipt.id) && styles.receiptCardSelected
              ]}>
                {multiSelectMode && (
                  <TouchableOpacity
                    style={styles.checkboxContainer}
                    onPress={() => toggleReceiptSelection(receipt.id)}
                  >
                    <MaterialIcons
                      name={selectedReceiptIds.has(receipt.id) ? "check-box" : "check-box-outline-blank"}
                      size={24}
                      color={selectedReceiptIds.has(receipt.id) ? "#2196F3" : "#ccc"}
                    />
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  style={styles.receiptImageContainer}
                  onPress={() => multiSelectMode ? toggleReceiptSelection(receipt.id) : viewReceiptImage(receipt)}
                >
                  <Image source={{ uri: receipt.imageUri }} style={styles.receiptThumbnail} />
                  <View style={styles.imageOverlay}>
                    <MaterialIcons name="zoom-in" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.receiptInfo}
                  onPress={() => viewReceiptDetails(receipt)}
                >
                  <View style={styles.receiptHeader}>
                    <Text style={styles.receiptVendor}>{receipt.vendor}</Text>
                    <Text style={styles.receiptAmount}>${receipt.amount.toFixed(2)}</Text>
                  </View>
                  
                  <Text style={styles.receiptDescription}>{receipt.description}</Text>
                  
                  <View style={styles.receiptDetails}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{receipt.category}</Text>
                    </View>
                    <Text style={styles.receiptDate}>{formatDate(receipt.date)}</Text>
                  </View>
                  
                  {receipt.costCenter && (
                    <View style={styles.costCenterBadge}>
                      <MaterialIcons name="business" size={14} color="#2196F3" />
                      <Text style={styles.costCenterText}>{receipt.costCenter}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {!multiSelectMode && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteReceipt(receipt)}
                  >
                    <MaterialIcons name="delete" size={20} color="#f44336" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowImageModal(false)}
            >
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            
            {selectedReceipt && (
              <>
                <Image
                  source={{ uri: selectedReceipt.imageUri }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
                <View style={styles.imageInfo}>
                  <Text style={styles.imageVendor}>{selectedReceipt.vendor}</Text>
                  <Text style={styles.imageAmount}>${selectedReceipt.amount.toFixed(2)}</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Receipt Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.detailsModalContent}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>Receipt Details</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowDetailsModal(false)}
              >
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {selectedReceipt && (
              <ScrollView style={styles.detailsContent}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Vendor:</Text>
                  <Text style={styles.detailValue}>{selectedReceipt.vendor}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={styles.detailValue}>${selectedReceipt.amount.toFixed(2)}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Category:</Text>
                  <Text style={styles.detailValue}>{selectedReceipt.category}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cost Center:</Text>
                  <Text style={styles.detailValue}>{selectedReceipt.costCenter || 'Not assigned'}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedReceipt.date)}</Text>
                </View>
                
                {selectedReceipt.description && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Description:</Text>
                    <Text style={styles.detailValue}>{selectedReceipt.description}</Text>
                  </View>
                )}
                
                <TouchableOpacity
                  style={styles.viewImageButton}
                  onPress={() => {
                    setShowDetailsModal(false);
                    setShowImageModal(true);
                  }}
                >
                  <MaterialIcons name="image" size={20} color="#fff" />
                  <Text style={styles.viewImageButtonText}>View Receipt Image</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
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
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  addReceiptButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addReceiptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  generateButton: {
    backgroundColor: '#f44336',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  categoryContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryName: {
    fontSize: 14,
    color: '#333',
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  receiptsContainer: {
    marginBottom: 20,
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
  receiptCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  receiptImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  receiptThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptInfo: {
    flex: 1,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  receiptVendor: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  receiptAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  receiptDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  receiptDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  receiptDate: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '80%',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  fullImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  imageInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageVendor: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageAmount: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Multi-select styles
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 12,
  },
  multiSelectContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  multiSelectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  multiSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  multiSelectButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  multiSelectActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#e3f2fd',
  },
  selectAllButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  clearAllButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  checkboxContainer: {
    padding: 8,
    marginRight: 8,
  },
  receiptCardSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  
  // Cost center badge styles
  costCenterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  costCenterText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  
  // Details modal styles
  detailsModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  detailsContent: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  viewImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  viewImageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

