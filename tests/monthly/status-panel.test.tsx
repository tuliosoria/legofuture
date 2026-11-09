import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { MonthlyDataStatus } from '@/components/sets/MonthlyDataStatus';
it('distinguishes the current month from missing data and a disabled scheduler', () => {
  render(<MonthlyDataStatus now={new Date('2026-11-09T17:00:00Z')} />);
  expect(screen.getByText('Monthly update · November 2026')).toBeTruthy();
  expect(screen.getByText(/No verified price update or best-buy ranking/)).toBeTruthy();
  expect(screen.getByText(/Monthly automation is not enabled/)).toBeTruthy();
  expect(screen.queryByText(/Updated in November/)).toBeNull();
});
