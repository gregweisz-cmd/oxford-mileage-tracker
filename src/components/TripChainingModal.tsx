import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { TripChainSuggestion, TripChainingAiService } from '../services/tripChainingAiService';
import { useTheme } from '../contexts/ThemeContext';

interface TripChainingModalProps {
  visible: boolean;
  onClose: () => void;
  suggestions: TripChainSuggestion[];
  onApplySuggestion: (suggestion: TripChainSuggestion) => void;
  startLocation: string;
  endLocation: string;
}

export default function TripChainingModal({
  visible,
  onClose,
  suggestions,
  onApplySuggestion,
  startLocation,
  endLocation,
}: TripChainingModalProps) {
  const { colors } = useTheme();
  const [selectedSuggestion, setSelectedSuggestion] = useState<TripChainSuggestion | null>(null);

  const handleApplySuggestion = (suggestion: TripChainSuggestion) => {
    Alert.alert(
      'Apply Trip Chaining',
      `Apply this optimization?\n\n${suggestion.title}\n${suggestion.description}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: () => {
            onApplySuggestion(suggestion);
            onClose();
          },
        },
      ]
    );
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'nearby_house':
        return 'home';
      case 'route_optimization':
        return 'route';
      case 'multi_stop':
        return 'swap-horiz';
      default:
        return 'lightbulb';
    }
  };

  const getSuggestionColor = (type: string) => {
    switch (type) {
      case 'nearby_house':
        return '#4CAF50';
      case 'route_optimization':
        return '#2196F3';
      case 'multi_stop':
        return '#FF9800';
      default:
        return colors.primary;
    }
  };

  const formatSavings = (savings: { miles: number; minutes: number; fuelCost: number }) => {
    const parts = [];
    
    if (savings.miles > 0) {
      parts.push(`${savings.miles.toFixed(1)} mi saved`);
    } else if (savings.miles < 0) {
      parts.push(`${Math.abs(savings.miles).toFixed(1)} mi added`);
    }
    
    if (savings.minutes > 0) {
      parts.push(`${savings.minutes.toFixed(0)} min saved`);
    } else if (savings.minutes < 0) {
      parts.push(`${Math.abs(savings.minutes).toFixed(0)} min added`);
    }
    
    if (savings.fuelCost > 0) {
      parts.push(`$${savings.fuelCost.toFixed(2)} saved`);
    } else if (savings.fuelCost < 0) {
      parts.push(`$${Math.abs(savings.fuelCost).toFixed(2)} added`);
    }
    
    return parts.join(' • ');
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      width: '90%',
      maxHeight: '80%',
      maxWidth: 500,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
    },
    routeInfo: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    routeText: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    routeSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    suggestionsContainer: {
      maxHeight: 400,
    },
    suggestionCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
    },
    suggestionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    suggestionIcon: {
      marginRight: 12,
    },
    suggestionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      flex: 1,
    },
    confidenceBadge: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    confidenceText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    suggestionDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    suggestionRoute: {
      fontSize: 14,
      color: colors.text,
      fontStyle: 'italic',
      marginBottom: 8,
    },
    savingsInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    savingsIcon: {
      marginRight: 8,
    },
    savingsText: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
    },
    stopsContainer: {
      marginBottom: 12,
    },
    stopsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    stopItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    stopIcon: {
      marginRight: 8,
    },
    stopText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    button: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 8,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      marginLeft: 8,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButtonText: {
      color: colors.text,
    },
    primaryButtonText: {
      color: '#fff',
    },
    emptyState: {
      alignItems: 'center',
      padding: 40,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    emptyDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Trip Chaining Suggestions</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.routeInfo}>
            <Text style={styles.routeText}>
              {startLocation} → {endLocation}
            </Text>
            <Text style={styles.routeSubtext}>
              AI found {suggestions.length} optimization opportunity{suggestions.length !== 1 ? 'ies' : ''}
            </Text>
          </View>

          {suggestions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="route" size={48} color={colors.textSecondary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No Suggestions Found</Text>
              <Text style={styles.emptyDescription}>
                No trip chaining opportunities detected for this route. Try a different start or end location.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.suggestionsContainer} showsVerticalScrollIndicator={false}>
              {suggestions.map((suggestion) => (
                <View
                  key={suggestion.id}
                  style={[
                    styles.suggestionCard,
                    { borderLeftColor: getSuggestionColor(suggestion.type) }
                  ]}
                >
                  <View style={styles.suggestionHeader}>
                    <MaterialIcons
                      name={getSuggestionIcon(suggestion.type)}
                      size={24}
                      color={getSuggestionColor(suggestion.type)}
                      style={styles.suggestionIcon}
                    />
                    <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                    <View style={styles.confidenceBadge}>
                      <Text style={styles.confidenceText}>
                        {suggestion.confidence}%
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.suggestionDescription}>
                    {suggestion.description}
                  </Text>

                  <Text style={styles.suggestionRoute}>
                    {suggestion.suggestedRoute}
                  </Text>

                  <View style={styles.savingsInfo}>
                    <MaterialIcons
                      name="trending-down"
                      size={16}
                      color={colors.textSecondary}
                      style={styles.savingsIcon}
                    />
                    <Text style={styles.savingsText}>
                      {formatSavings(suggestion.estimatedSavings)}
                    </Text>
                  </View>

                  {suggestion.optimizedStops.length > 0 && (
                    <View style={styles.stopsContainer}>
                      <Text style={styles.stopsTitle}>Stops:</Text>
                      {suggestion.optimizedStops.map((stop, index) => (
                        <View key={index} style={styles.stopItem}>
                          <MaterialIcons
                            name="location-on"
                            size={16}
                            color={colors.textSecondary}
                            style={styles.stopIcon}
                          />
                          <Text style={styles.stopText}>
                            {stop.house.name} - {stop.purpose} ({stop.estimatedTime} min)
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.button, styles.primaryButton]}
                    onPress={() => handleApplySuggestion(suggestion)}
                  >
                    <Text style={[styles.buttonText, styles.primaryButtonText]}>
                      Apply This Route
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={onClose}>
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
