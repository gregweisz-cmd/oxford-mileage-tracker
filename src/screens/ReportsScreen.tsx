import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';
import { SlackService } from '../services/slackService';
import { DailyMileageService, DailyMileageSummary } from '../services/dailyMileageService';
import { MonthlyReport, MileageEntry, Employee } from '../types';
import { formatLocationRoute } from '../utils/locationFormatter';

interface ReportsScreenProps {
  navigation: any;
}

export default function ReportsScreen({ navigation }: ReportsScreenProps) {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailyMileageSummary[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSlackConfig, setShowSlackConfig] = useState(false);
  const [showEntriesModal, setShowEntriesModal] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null);
  const [selectedDailySummary, setSelectedDailySummary] = useState<DailyMileageSummary | null>(null);
  const [reportEntries, setReportEntries] = useState<MileageEntry[]>([]);
  const [slackConfig, setSlackConfig] = useState({
    webhookUrl: '',
    channel: '',
    botToken: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const employee = await DatabaseService.getCurrentEmployee(); // Use current logged-in employee
      
      if (employee) {
        setCurrentEmployee(employee);
        const employeeReports = await DatabaseService.getMonthlyReports(employee.id);
        setReports(employeeReports);
        
        // Load daily summaries for the current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const summaries = await DailyMileageService.getDailyMileageSummaries(employee.id, startOfMonth, endOfMonth);
        setDailySummaries(summaries);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      Alert.alert('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyReport = async (month: number, year: number) => {
    if (!currentEmployee) return;

    try {
      // Get all entries for the month
      const entries = await DatabaseService.getMileageEntries(
        currentEmployee.id,
        month,
        year
      );

      if (entries.length === 0) {
        Alert.alert('No Data', 'No mileage entries found for this month');
        return;
      }

      // Calculate total miles
      const totalMiles = entries.reduce((sum, entry) => sum + entry.miles, 0);

      // Create monthly report
      const report = await DatabaseService.createMonthlyReport({
        employeeId: currentEmployee.id,
        month,
        year,
        totalMiles,
        entries,
        status: 'draft',
      });

      Alert.alert('Success', 'Monthly report generated successfully');
      loadData(); // Refresh the list
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'Failed to generate monthly report');
    }
  };

  const exportToSlack = async (report: MonthlyReport) => {
    if (!currentEmployee) return;

    try {
      // Get entries for this report
      const entries = await DatabaseService.getMileageEntries(
        currentEmployee.id,
        report.month,
        report.year
      );

      const success = await SlackService.exportMonthlyReportToSlack(
        report,
        entries,
        currentEmployee
      );

      if (success) {
        Alert.alert('Success', 'Report exported to Slack successfully');
      } else {
        Alert.alert('Error', 'Failed to export report to Slack');
      }
    } catch (error) {
      console.error('Error exporting to Slack:', error);
      Alert.alert('Error', 'Failed to export report to Slack');
    }
  };

  const shareReportLocally = async (report: MonthlyReport) => {
    if (!currentEmployee) return;

    try {
      const entries = await DatabaseService.getMileageEntries(
        currentEmployee.id,
        report.month,
        report.year
      );

      await SlackService.shareReportLocally(report, entries, currentEmployee);
    } catch (error) {
      console.error('Error sharing report:', error);
      Alert.alert('Error', 'Failed to share report');
    }
  };

  const saveSlackConfig = () => {
    if (!slackConfig.webhookUrl || !slackConfig.channel) {
      Alert.alert('Validation Error', 'Webhook URL and Channel are required');
      return;
    }

    SlackService.setConfig({
      webhookUrl: slackConfig.webhookUrl,
      channel: slackConfig.channel,
      botToken: slackConfig.botToken || undefined,
    });

    setShowSlackConfig(false);
    Alert.alert('Success', 'Slack configuration saved');
  };

  const viewReportEntries = async (report: MonthlyReport) => {
    if (!currentEmployee) return;

    try {
      const entries = await DatabaseService.getMileageEntries(
        currentEmployee.id,
        report.month,
        report.year
      );
      
      setSelectedReport(report);
      setReportEntries(entries);
      setShowEntriesModal(true);
    } catch (error) {
      console.error('Error loading entries:', error);
      Alert.alert('Error', 'Failed to load report entries');
    }
  };

  const handleViewDailySummary = (summary: DailyMileageSummary) => {
    setSelectedDailySummary(summary);
    setShowDailyModal(true);
  };

  const handleDeleteTrip = async (tripId: string) => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteMileageEntry(tripId);
              
              // Refresh the daily summary data
              if (selectedDailySummary) {
                // Load fresh data
                const employee = await DatabaseService.getCurrentEmployee();
                if (employee) {
                  const now = new Date();
                  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                  const freshSummaries = await DailyMileageService.getDailyMileageSummaries(employee.id, startOfMonth, endOfMonth);
                  
                  // Find the updated summary for the same date
                  const updatedSummary = freshSummaries.find(s => 
                    s.date.toDateString() === selectedDailySummary.date.toDateString()
                  );
                  
                  if (updatedSummary) {
                    // Update the selected summary with fresh data
                    setSelectedDailySummary(updatedSummary);
                    setDailySummaries(freshSummaries);
                  } else {
                    // If no trips left for this date, close the modal
                    setShowDailyModal(false);
                    setSelectedDailySummary(null);
                    setDailySummaries(freshSummaries);
                  }
                }
              }
              
              Alert.alert('Success', 'Trip deleted successfully');
            } catch (error) {
              console.error('Error deleting trip:', error);
              Alert.alert('Error', 'Failed to delete trip');
            }
          },
        },
      ]
    );
  };

  const deleteEntry = async (entryId: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this mileage entry? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteMileageEntry(entryId);
              
              // Remove from local state
              setReportEntries(prev => prev.filter(entry => entry.id !== entryId));
              
              // Update the report total miles
              if (selectedReport) {
                const updatedEntries = reportEntries.filter(entry => entry.id !== entryId);
                const newTotalMiles = updatedEntries.reduce((sum, entry) => sum + entry.miles, 0);
                
                // Update the report in the database
                await DatabaseService.updateMonthlyReport(selectedReport.id, {
                  totalMiles: newTotalMiles
                });
                
                // Refresh the reports list
                loadData();
              }
              
              Alert.alert('Success', 'Mileage entry deleted successfully');
            } catch (error) {
              console.error('Error deleting entry:', error);
              Alert.alert('Error', 'Failed to delete mileage entry');
            }
          },
        },
      ]
    );
  };

  const editEntry = (entryId: string) => {
    // Navigate to MileageEntryScreen with the entry ID for editing
    navigation.navigate('MileageEntry', { 
      entryId: entryId,
      isEditing: true 
    });
  };

  const formatMonthYear = (month: number, year: number) => {
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const submitMonthlyReport = (reportId: string) => {
    Alert.alert(
      'Submit Report',
      'Are you sure you want to submit this report? Once submitted, it cannot be edited.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              await DatabaseService.updateMonthlyReport(reportId, { status: 'submitted' });
              
              // Update local state
              setReports(prev => prev.map(report => 
                report.id === reportId 
                  ? { ...report, status: 'submitted' as const }
                  : report
              ));
              
              Alert.alert('Success', 'Report submitted successfully');
            } catch (error) {
              console.error('Error submitting monthly report:', error);
              Alert.alert('Error', 'Failed to submit report');
            }
          }
        }
      ]
    );
  };

  const deleteMonthlyReport = (reportId: string) => {
    Alert.alert(
      'Delete Draft Report',
      'Are you sure you want to delete this draft report? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteMonthlyReport(reportId);
              
              // Remove from local state
              setReports(prev => prev.filter(report => report.id !== reportId));
              
              Alert.alert('Success', 'Draft report deleted successfully');
            } catch (error) {
              console.error('Error deleting monthly report:', error);
              Alert.alert('Error', 'Failed to delete draft report');
            }
          }
        }
      ]
    );
  };

  const getCurrentMonthYear = () => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading reports...</Text>
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
        <Text style={styles.headerTitle}>Monthly Reports</Text>
        <TouchableOpacity onPress={() => setShowSlackConfig(true)}>
          <MaterialIcons name="settings" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Generate Report Button */}
        <TouchableOpacity
          style={styles.generateButton}
          onPress={() => {
            const { month, year } = getCurrentMonthYear();
            generateMonthlyReport(month, year);
          }}
        >
          <MaterialIcons name="add" size={24} color="#fff" />
          <Text style={styles.generateButtonText}>Generate Current Month Report</Text>
        </TouchableOpacity>

        {/* Reports List */}
        <View style={styles.reportsContainer}>
          <Text style={styles.sectionTitle}>Generated Reports</Text>
          
          {reports.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="assessment" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No reports generated yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Generate a monthly report to get started
              </Text>
            </View>
          ) : (
            reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportTitle}>
                    {formatMonthYear(report.month, report.year)}
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: report.status === 'approved' ? '#4CAF50' : 
                                      report.status === 'submitted' ? '#FF9800' : '#2196F3' }
                  ]}>
                    <Text style={styles.statusText}>
                      {report.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.reportStats}>
                  <View style={styles.statItem}>
                    <MaterialIcons name="speed" size={16} color="#4CAF50" />
                    <Text style={styles.statText}>{report.totalMiles} miles</Text>
                  </View>
                  <View style={styles.statItem}>
                    <MaterialIcons name="calendar-today" size={16} color="#2196F3" />
                    <Text style={styles.statText}>
                      {report.createdAt.toLocaleDateString()}
                    </Text>
                  </View>
                </View>

                {/* Action buttons - only show Submit/Delete for drafts */}
                {report.status === 'draft' && (
                  <View style={styles.reportActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
                      onPress={() => submitMonthlyReport(report.id)}
                    >
                      <MaterialIcons name="check" size={16} color="#fff" />
                      <Text style={[styles.actionButtonText, { color: '#fff' }]}>Submit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#f44336' }]}
                      onPress={() => deleteMonthlyReport(report.id)}
                    >
                      <MaterialIcons name="delete" size={16} color="#fff" />
                      <Text style={[styles.actionButtonText, { color: '#fff' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Daily Mileage Summaries */}
        <View style={styles.reportsContainer}>
          <Text style={styles.sectionTitle}>Daily Mileage Summaries</Text>
          
          {dailySummaries.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="directions-car" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No daily summaries yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Create mileage entries to see daily summaries with odometer readings
              </Text>
            </View>
          ) : (
            dailySummaries.map((summary) => (
              <View key={summary.date.toISOString()} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportTitle}>
                    {summary.date.toLocaleDateString()}
                  </Text>
                  <Text style={styles.reportSubtitle}>
                    {summary.tripCount} trips • {summary.totalMiles.toFixed(1)} miles
                  </Text>
                </View>

                <View style={styles.reportStats}>
                  <View style={styles.statItem}>
                    <MaterialIcons name="speed" size={16} color="#4CAF50" />
                    <Text style={styles.statText}>
                      Start: {summary.startingOdometer ? summary.startingOdometer.toLocaleString() : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <MaterialIcons name="flag" size={16} color="#FF9800" />
                    <Text style={styles.statText}>
                      End: {summary.endingOdometer ? summary.endingOdometer.toLocaleString() : 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.reportActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleViewDailySummary(summary)}
                  >
                    <MaterialIcons name="list" size={16} color="#FF9800" />
                    <Text style={styles.actionButtonText}>View Trips</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Slack Configuration Modal */}
      <Modal
        visible={showSlackConfig}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSlackConfig(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Slack Configuration</Text>
            <TouchableOpacity onPress={saveSlackConfig}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Webhook URL *</Text>
              <TextInput
                style={styles.input}
                value={slackConfig.webhookUrl}
                onChangeText={(value) => setSlackConfig(prev => ({ ...prev, webhookUrl: value }))}
                placeholder="https://hooks.slack.com/services/..."
                placeholderTextColor="#999"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Channel *</Text>
              <TextInput
                style={styles.input}
                value={slackConfig.channel}
                onChangeText={(value) => setSlackConfig(prev => ({ ...prev, channel: value }))}
                placeholder="#mileage-reports"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bot Token (Optional)</Text>
              <TextInput
                style={styles.input}
                value={slackConfig.botToken}
                onChangeText={(value) => setSlackConfig(prev => ({ ...prev, botToken: value }))}
                placeholder="xoxb-..."
                placeholderTextColor="#999"
                autoCapitalize="none"
                secureTextEntry
              />
            </View>

            <Text style={styles.helpText}>
              To set up Slack integration:{'\n'}
              1. Create a Slack app in your workspace{'\n'}
              2. Add a webhook URL or bot token{'\n'}
              3. Configure the channel where reports will be posted
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Entries Modal */}
      <Modal
        visible={showEntriesModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEntriesModal(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedReport ? formatMonthYear(selectedReport.month, selectedReport.year) : ''} Entries
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {reportEntries.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="list" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No entries found</Text>
              </View>
            ) : (
              reportEntries.map((entry) => (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <View style={styles.entryInfo}>
                      <Text style={styles.entryDate}>
                        {entry.date.toLocaleDateString()}
                      </Text>
                      <Text style={styles.entryPurpose}>{entry.purpose}</Text>
                    </View>
                    <View style={styles.entryActions}>
                      <Text style={styles.entryMiles}>{entry.miles.toFixed(1)} mi</Text>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => editEntry(entry.id)}
                      >
                        <MaterialIcons name="edit" size={20} color="#2196F3" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => deleteEntry(entry.id)}
                      >
                        <MaterialIcons name="delete" size={20} color="#f44336" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.entryDetails}>
                    <Text style={styles.entryRoute}>
                      {formatLocationRoute(entry)}
                    </Text>
                    {entry.isGpsTracked && (
                      <View style={styles.gpsBadge}>
                        <MaterialIcons name="gps-fixed" size={12} color="#4CAF50" />
                        <Text style={styles.gpsText}>GPS Tracked</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Daily Summary Modal */}
      <Modal
        visible={showDailyModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDailyModal(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedDailySummary?.date.toLocaleDateString()} - Trip Details
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedDailySummary && (
              <>
                {/* Daily Summary Header */}
                <View style={styles.dailySummaryHeader}>
                  <View style={styles.summaryStat}>
                    <MaterialIcons name="speed" size={24} color="#4CAF50" />
                    <Text style={styles.summaryStatLabel}>Starting Odometer</Text>
                    <Text style={styles.summaryStatValue}>
                      {selectedDailySummary.startingOdometer ? selectedDailySummary.startingOdometer.toLocaleString() : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.summaryStat}>
                    <MaterialIcons name="flag" size={24} color="#FF9800" />
                    <Text style={styles.summaryStatLabel}>Ending Odometer</Text>
                    <Text style={styles.summaryStatValue}>
                      {selectedDailySummary.endingOdometer ? selectedDailySummary.endingOdometer.toLocaleString() : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.summaryStat}>
                    <MaterialIcons name="directions-car" size={24} color="#2196F3" />
                    <Text style={styles.summaryStatLabel}>Total Miles</Text>
                    <Text style={styles.summaryStatValue}>
                      {selectedDailySummary.totalMiles.toFixed(1)}
                    </Text>
                  </View>
                </View>

                {/* Trip Details */}
                <Text style={styles.tripsTitle}>Trip Details</Text>
                {selectedDailySummary.trips.map((trip, index) => (
                  <View key={trip.id} style={styles.tripCard}>
                    <View style={styles.tripHeader}>
                      <Text style={styles.tripNumber}>Trip {index + 1}</Text>
                      <View style={styles.tripHeaderRight}>
                        <Text style={styles.tripMiles}>{trip.miles.toFixed(1)} miles</Text>
                        <TouchableOpacity
                          style={styles.deleteTripButton}
                          onPress={() => handleDeleteTrip(trip.id)}
                        >
                          <MaterialIcons name="delete" size={20} color="#f44336" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.tripPurpose}>{trip.purpose}</Text>
                    <Text style={styles.tripRoute}>
                      {formatLocationRoute(trip)}
                    </Text>
                    <View style={styles.tripOdometer}>
                      <Text style={styles.tripOdometerText}>
                        Odometer: {trip.odometerReading ? trip.odometerReading.toLocaleString() : 'N/A'} → {trip.odometerReading ? (trip.odometerReading + trip.miles).toLocaleString() : 'N/A'}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
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
  generateButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
  reportsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
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
  reportCard: {
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
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  reportSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  reportStats: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saveText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginTop: 20,
  },
  entryCard: {
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
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  entryInfo: {
    flex: 1,
  },
  entryDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  entryPurpose: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  entryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryMiles: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginRight: 8,
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
    marginRight: 8,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#ffebee',
  },
  entryDetails: {
    marginTop: 8,
  },
  entryRoute: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  entryVehicle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  gpsText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
  },
  // Daily Summary Styles
  dailySummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  summaryStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  tripsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  tripCard: {
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
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  tripHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripMiles: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginRight: 12,
  },
  deleteTripButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#ffebee',
  },
  tripPurpose: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  tripRoute: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  tripOdometer: {
    backgroundColor: '#f0f8ff',
    padding: 8,
    borderRadius: 8,
  },
  tripOdometerText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
});

