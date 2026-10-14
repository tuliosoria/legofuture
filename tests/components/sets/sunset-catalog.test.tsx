import React from 'react';
import {render,screen} from '@testing-library/react';
import {it,expect} from 'vitest';
import { SunsetCatalog } from '@/components/sets/SunsetCatalog';
it('retains catalog search and offers without prices or rankings',()=>{render(<SunsetCatalog sets={[{id:'set',name:'LEGO set',setNumber:'10316',theme:'Icons',year:2023,status:'Active',pieces:100}]} />);expect(screen.getByRole('searchbox')).toBeTruthy();expect(screen.getByText(/Forecasts and sold-price rankings are suspended/)).toBeTruthy();expect(screen.getAllByText('Price unavailable').length).toBeGreaterThan(0);expect(screen.queryByText(/Strong Buy/)).toBeNull();expect(screen.getAllByText('View set →').length).toBeGreaterThan(0);});
