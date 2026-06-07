// Project store. Server-backed as of Agent 5 (Frontend Task Migration).
//
// The store mirrors the server's `Project` table for the currently
// authenticated user. Reads go through `projectRepository.list`; writes
// hit the corresponding REST endpoints and the local Zustand state is
// updated optimistically after a successful response.
//
// The previous Dexie auto-seed of a "General" project (when the user had
// no projects) is gone. The server has no concept of an implicit project;
// new users start with an empty project list. See Agent 2's decisions.

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Project } from '../types';
import { projectRepository, type ProjectUpdateInput } from '../repositories/projectRepository';
import { ApiError } from '../services/apiClient';
import { useUIStore } from './uiStore';

const PROJECT_COLORS = [
  'text-blue-500',
  'text-emerald-500',
  'text-amber-500',
  'text-rose-500',
  'text-violet-500',
  'text-cyan-500',
  'text-orange-500',
  'text-pink-500',
];

function showError(err: unknown, fallback: string): void {
  const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : fallback;
  useUIStore.getState().showToast(msg, 'error');
}

interface ProjectStore {
  projects: Project[];
  isLoaded: boolean;

  loadProjects: () => Promise<void>;
  createProject: (name: string) => Promise<Project | null>;
  updateProject: (id: string, updates: ProjectUpdateInput) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProjectById: (id: string | null) => Project | undefined;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  isLoaded: false,

  loadProjects: async () => {
    try {
      const { projects } = await projectRepository.list();
      set({ projects, isLoaded: true });
    } catch (err) {
      set({ isLoaded: true });
      showError(err, 'Failed to load projects.');
    }
  },

  createProject: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = nanoid(8);
    const color = PROJECT_COLORS[get().projects.length % PROJECT_COLORS.length];
    try {
      const { project } = await projectRepository.create({ id, name: trimmed, color });
      set((s) => ({ projects: [...s.projects, project] }));
      return project;
    } catch (err) {
      showError(err, 'Failed to create project.');
      return null;
    }
  },

  updateProject: async (id, updates) => {
    // Optimistic local update — we revert on error so the UI doesn't drift.
    const previous = get().projects.find((p) => p.id === id);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
    try {
      const { project } = await projectRepository.update(id, updates);
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? project : p)),
      }));
    } catch (err) {
      if (previous) {
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? previous : p)),
        }));
      }
      showError(err, 'Failed to update project.');
    }
  },

  deleteProject: async (id) => {
    const previous = get().projects;
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
    try {
      await projectRepository.remove(id);
    } catch (err) {
      set({ projects: previous });
      showError(err, 'Failed to delete project.');
    }
  },

  getProjectById: (id) => {
    if (!id) return undefined;
    return get().projects.find((p) => p.id === id);
  },
}));
