import React from 'react';
import { render, screen } from '@testing-library/react';
import PortalRouter from './PortalRouter';

// Mock jsPDF to avoid TextEncoder issues in test environment
jest.mock('jspdf', () => ({
  jsPDF: jest.fn().mockImplementation(() => ({
    setFontSize: jest.fn(),
    setFont: jest.fn(),
    text: jest.fn(),
    rect: jest.fn(),
    addPage: jest.fn(),
    save: jest.fn(),
    addImage: jest.fn(),
    line: jest.fn(),
    setDrawColor: jest.fn(),
    setLineWidth: jest.fn()
  }))
}));

test('renders Oxford House Expense System', () => {
  render(<PortalRouter />);
  const titleElement = screen.getByText(/Oxford House Expense System/i);
  expect(titleElement).toBeInTheDocument();
});
