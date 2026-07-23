import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AreaSwitcher } from './AreaSwitcher';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AreaSwitcher />
    </MemoryRouter>,
  );
}

describe('AreaSwitcher', () => {
  it('renders exactly six areas — Agent, Work, Clients, Today, Files, Settings — no more, no fewer', () => {
    renderAt('/work');

    const nav = screen.getByRole('navigation', { name: 'Areas' });
    const buttons = within(nav).getAllByRole('button');

    expect(buttons).toHaveLength(6);
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Agent',
      'Work',
      'Clients',
      'Today',
      'Files',
      'Settings',
    ]);
  });

  it('marks only the area matching the current URL as active', () => {
    renderAt('/clients');

    expect(screen.getByRole('button', { name: 'Clients' })).toHaveAttribute('aria-current', 'page');
    for (const label of ['Agent', 'Work', 'Today', 'Files', 'Settings']) {
      expect(screen.getByRole('button', { name: label })).not.toHaveAttribute('aria-current');
    }
  });

  it('treats an unknown/nested path as belonging to its first-segment area', () => {
    renderAt('/clients/pipeline/deep');
    expect(screen.getByRole('button', { name: 'Clients' })).toHaveAttribute('aria-current', 'page');
  });

  it('clicking an area button navigates and moves the active marker', async () => {
    const user = userEvent.setup();
    renderAt('/work');

    expect(screen.getByRole('button', { name: 'Today' })).not.toHaveAttribute('aria-current');
    await user.click(screen.getByRole('button', { name: 'Today' }));

    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Work' })).not.toHaveAttribute('aria-current');
  });
});
