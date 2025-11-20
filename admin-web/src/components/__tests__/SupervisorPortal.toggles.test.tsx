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

describe('SupervisorPortal dashboard toggles', () => {
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

  it('toggles dashboard widgets visibility and persists preference', async () => {
    render(<SupervisorPortal supervisorId="super-1" supervisorName="Sam Supervisor" />);

    const widgetsToggle = await screen.findByLabelText('Show widgets');
    const dashboardToggle = await screen.findByLabelText('Show supervisor dashboard');

    expect(widgetsToggle).toBeChecked();
    expect(dashboardToggle).toBeChecked();

    await waitFor(() => expect(mockDashboardStatistics).toHaveBeenCalled());
    await waitFor(() => expect(mockSupervisorDashboard).toHaveBeenCalled());
    await waitFor(() => expect(mockSupervisorDashboardMounts).toBe(1));
    expect(screen.getByLabelText('Show supervisor dashboard')).toBeChecked();
    expect(screen.getByLabelText('Show widgets')).toBeChecked();
    expect(screen.getByTestId('supervisor-dashboard')).toBeInTheDocument();

    fireEvent.click(widgetsToggle);

    await waitFor(() => expect(widgetsToggle).not.toBeChecked());
    await waitFor(() =>
      expect(window.localStorage.getItem('supervisorPortal.showDashboardWidgets')).toBe('false')
    );
    await waitFor(() => {
      const lastCall = mockSupervisorDashboard.mock.calls[mockSupervisorDashboard.mock.calls.length - 1];
      expect(lastCall[0].showKpiCards).toBe(false);
    });
    expect(screen.getByTestId('supervisor-dashboard')).toBeInTheDocument();

    fireEvent.click(dashboardToggle);

    await waitFor(() => expect(dashboardToggle).not.toBeChecked());
    await waitFor(() =>
      expect(window.localStorage.getItem('supervisorPortal.showSupervisorDashboard')).toBe('false')
    );
    await waitFor(() => expect(mockSupervisorDashboardUnmounts).toBe(1));
    await waitFor(() => expect(screen.queryByTestId('supervisor-dashboard')).not.toBeInTheDocument());
  });

  it('initializes toggle state from stored preferences', async () => {
    window.localStorage.setItem('supervisorPortal.showDashboardWidgets', 'false');
    window.localStorage.setItem('supervisorPortal.showSupervisorDashboard', 'false');

    render(<SupervisorPortal supervisorId="super-2" supervisorName="Stacey Supervisor" />);

    const widgetsToggle = await screen.findByLabelText('Show widgets');
    const dashboardToggle = await screen.findByLabelText('Show supervisor dashboard');

    expect(widgetsToggle).not.toBeChecked();
    expect(dashboardToggle).not.toBeChecked();
    await waitFor(() =>
      expect(window.localStorage.getItem('supervisorPortal.showDashboardWidgets')).toBe('false')
    );
    await waitFor(() =>
      expect(window.localStorage.getItem('supervisorPortal.showSupervisorDashboard')).toBe('false')
    );
    expect(mockDashboardStatistics).not.toHaveBeenCalled();
    expect(mockSupervisorDashboard).not.toHaveBeenCalled();
    expect(mockSupervisorDashboardMounts).toBe(0);
    expect(mockSupervisorDashboardUnmounts).toBe(0);
    expect(screen.queryByTestId('supervisor-dashboard')).not.toBeInTheDocument();
  });
});

