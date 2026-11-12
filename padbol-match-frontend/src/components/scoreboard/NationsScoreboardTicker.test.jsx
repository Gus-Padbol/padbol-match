import React from 'react';
import {render, screen, within} from '@testing-library/react';
import NationsScoreboardTicker from './NationsScoreboardTicker';

test('approved public sponsors form two equal groups with only one accessible copy', () => {
  const sponsors = [{id:1,nombre:'Club sponsor',logo_url:'https://public.example/logo.png'}, {id:2,nombre:'Local partner',logo_url:'/sponsors/local.svg'}];
  const original = JSON.stringify(sponsors);
  const {container} = render(<NationsScoreboardTicker sponsors={sponsors} />);
  expect(screen.getByRole('img', {name:'Padbol Match'})).toHaveAttribute('src','/brand/padbol-match-logo-white.svg');
  const groups = container.querySelectorAll('.sb-nations-marquee__group');
  expect(groups).toHaveLength(2);
  expect(groups[0].innerHTML).toBe(groups[1].innerHTML);
  expect(groups[1]).toHaveAttribute('aria-hidden','true');
  expect(within(groups[0]).getByRole('img', {name:'Padbol Match'})).toBeInTheDocument();
  expect(container.querySelector('.sb-nations-footer-brand')).toBeNull();
  expect(within(groups[0]).getByText('Club sponsor')).toBeInTheDocument();
  expect(JSON.stringify(sponsors)).toBe(original);
});

test('no configured sponsors repeats only the official brand, never invented advertisements', () => {
  const {container} = render(<NationsScoreboardTicker />);
  expect(screen.getByLabelText('Padbol Match branding')).toBeInTheDocument();
  expect(container.querySelectorAll('.sb-nations-marquee__logo')).toHaveLength(8);
  expect(container.querySelector('.sb-nations-marquee__sponsor')).toBeNull();
  expect([...container.querySelectorAll('img')].every(img => img.getAttribute('src') === '/brand/padbol-match-logo-white.svg')).toBe(true);
});

test('inactive, untargeted and unsafe images do not become ticker ads or remote image requests', () => {
  const {container} = render(<NationsScoreboardTicker sponsors={[
    {nombre:'Inactive',activo:false}, {nombre:'Break only',scoreboard_placements:['rest']},
    {nombre:'Text only',logo_url:'javascript:alert(1)'}, {nombre:'Protocol relative',logo_url:'//private.invalid/logo'},
    {nombre:'Private credential',logo_url:'https://secret:password@private.invalid/logo'},
  ]} />);
  expect(screen.queryByText('Inactive')).toBeNull();expect(screen.queryByText('Break only')).toBeNull();
  expect(container.querySelectorAll('.sb-nations-marquee__sponsor img')).toHaveLength(0);
  expect(screen.getAllByText('Text only')).toHaveLength(2);
});
