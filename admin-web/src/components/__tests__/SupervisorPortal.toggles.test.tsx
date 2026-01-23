import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SupervisorPortal from '../SupervisorPortal';

const mockDashboardStatistics = jest.fn();
const mockSupervisorDashboard = jest.fn();
let mockSupervisorDashboardMounts = 0;
let mockSupervisorDashboardUnmounts = 0;

jest.mock('../DashboardStatistics', () => {
  const React = require('react');
  const MockDashboardStatistics = (props: any) => {
    mockDashboardStatistics(props);
    return React.createElement('div', { 'data-testid': 'dashboard-stats' });
  };
  return {
    DashboardStatistics: MockDashboardStatistics,
  };
});

jest.mock('../SupervisorDashboard', () => {
  const React = require('react');

  const MockSupervisorDashboard = (props: any) => {
    React.useEffect(() => {
      mockSupervisorDashboardMounts += 1;
      return () => {
        mockSupervisorDashboardUnmounts += 1;
      };
    }, []);
    mockSupervisorDashboard(props);
    return React.createElement('div', {
      'data-testid': 'supervisor-dashboard',
      'data-show-kpis': props.showKpiCards ? 'true' : 'false',
    });
  };

  return {
    __esModule: true,
    default: MockSupervisorDashboard,
  };
});

jest.mock('../../StaffPortal', () => ({
  __esModule: true,
  default: () => <div data-testid="staff-portal" />,
}));

const mockFetch = jest.fn();

describe('SupervisorPortal dashboard', () => {
  beforeAll(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockSupervisorDashboardMounts = 0;
    mockSupervisorDashboardUnmounts = 0;

    mockFetch.mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/team') || url.includes('/expense-reports?teamSupervisorId=')) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        }) as Promise<Response>;
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      }) as Promise<Response>;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('always shows supervisor dashboard', async () => {
    render(<SupervisorPortal supervisorId="super-1" supervisorName="Sam Supervisor" />);

    await waitFor(() => expect(mockSupervisorDashboard).toHaveBeenCalled());
    await waitFor(() => expect(mockSupervisorDashboardMounts).toBe(1));
    expect(screen.getByTestId('supervisor-dashboard')).toBeInTheDocument();
  });
});

