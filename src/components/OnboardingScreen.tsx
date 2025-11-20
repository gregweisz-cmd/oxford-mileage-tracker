import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DatabaseService } from '../services/database';

interface OnboardingScreenProps {
  employeeId: string;
  onComplete: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingSlide {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
  color: string;
}

const slides: OnboardingSlide[] = [
  {
    icon: 'drive-eta',
    title: 'Track Mileage',
    description: 'Automatically track your trips with GPS or manually enter mileage. Everything syncs instantly.',
    color: '#2196F3',
  },
  {
    icon: 'receipt',
    title: 'Capture Receipts',
    description: 'Take photos of receipts and our OCR will extract vendor, amount, and date automatically.',
    color: '#4CAF50',
  },
  {
    icon: 'schedule',
    title: 'Log Time',
    description: 'Track your working hours across different cost centers and categories.',
    color: '#FF9800',
  },
  {
    icon: 'assessment',
    title: 'Generate Reports',
    description: 'Submit monthly expense reports with one click. Everything is organized and ready for approval.',
    color: '#9C27B0',
  },
  {
    icon: 'location-on',
    title: 'Smart Per Diem',
    description: 'Automatic per diem calculation based on your location, miles driven, and hours worked.',
    color: '#F44336',
  },
];

export default function OnboardingScreen({ employeeId, onComplete }: OnboardingScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));

  const handleNext = async () => {
    if (currentSlide < slides.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setCurrentSlide(currentSlide + 1);
    } else {
      // Complete onboarding
      await DatabaseService.setCompletedOnboarding(employeeId);
      onComplete();
    }
  };

  const handleSkip = async () => {
    await DatabaseService.setCompletedOnboarding(employeeId);
    onComplete();
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setCurrentSlide(currentSlide - 1);
    }
  };

  return (
    <View style={styles.container}>
      {/* Skip Button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipButtonText}>Skip</Text>
      </TouchableOpacity>

      {/* Slide Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        <Animated.View style={[styles.slideContainer, { opacity: fadeAnim }]}>
          <View style={[styles.iconContainer, { backgroundColor: slides[currentSlide].color + '20' }]}>
            <MaterialIcons
              name={slides[currentSlide].icon}
              size={120}
              color={slides[currentSlide].color}
            />
          </View>

          <Text style={styles.title}>{slides[currentSlide].title}</Text>
          <Text style={styles.description}>{slides[currentSlide].description}</Text>
        </Animated.View>

        {/* Dots Indicator */}
        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentSlide && styles.activeDot,
                { backgroundColor: index === currentSlide ? slides[currentSlide].color : '#ccc' },
              ]}
            />
          ))}
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.navigationContainer}>
        {currentSlide > 0 && (
          <TouchableOpacity style={styles.previousButton} onPress={handlePrevious}>
            <MaterialIcons name="arrow-back" size={24} color="#666" />
            <Text style={styles.previousButtonText}>Previous</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[
            styles.nextButton,
            { backgroundColor: slides[currentSlide].color, flex: currentSlide === 0 ? 1 : 0.5 },
          ]}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>
            {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          {currentSlide < slides.length - 1 && (
            <MaterialIcons name="arrow-forward" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  slideContainer: {
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    lineHeight: 28,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 6,
  },
  activeDot: {
    width: 30,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  previousButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  previousButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

