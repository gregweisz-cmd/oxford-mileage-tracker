import { OxfordHouse } from '../types';
import { OxfordHouseService } from '../services/oxfordHouseService';

const normalizeSearchValue = (value: unknown): string =>
  (value == null ? '' : String(value)).toLowerCase();

export const getAvailableOxfordHouseStates = (houses: OxfordHouse[]): string[] =>
  Array.from(
    new Set(
      houses
        .map((house) => OxfordHouseService.normalizeState(house.state))
        .filter(Boolean)
    )
  ).sort();

export const getDefaultOxfordHouseSelection = (
  houses: OxfordHouse[],
  baseAddress?: string
): {
  selectedState: string;
  results: OxfordHouse[];
} => {
  if (!baseAddress) {
    return { selectedState: '', results: houses };
  }

  const states = getAvailableOxfordHouseStates(houses);
  const extractedState = OxfordHouseService.extractStateFromAddress(baseAddress);
  if (!extractedState || !states.includes(extractedState)) {
    return { selectedState: '', results: houses };
  }

  const filteredByState = houses.filter(
    (house) => OxfordHouseService.normalizeState(house.state) === extractedState
  );

  // Never default users into an empty filter result.
  if (filteredByState.length === 0) {
    return { selectedState: '', results: houses };
  }

  return {
    selectedState: extractedState,
    results: filteredByState,
  };
};

export const filterOxfordHousesForPicker = (
  houses: OxfordHouse[],
  selectedState: string,
  query: string
): OxfordHouse[] => {
  const stateFiltered = selectedState
    ? houses.filter((house) => OxfordHouseService.normalizeState(house.state) === selectedState)
    : houses;

  if (!query.trim()) {
    return stateFiltered;
  }

  const searchLower = query.toLowerCase().trim();
  return stateFiltered.filter(
    (house) =>
      normalizeSearchValue(house.name).includes(searchLower) ||
      normalizeSearchValue(house.address).includes(searchLower) ||
      normalizeSearchValue(house.city).includes(searchLower) ||
      normalizeSearchValue(house.state).includes(searchLower) ||
      normalizeSearchValue(house.zipCode).includes(searchLower)
  );
};

