import { create } from 'zustand';
import type { PipelineTask, PipelineStep, PipelineTaskStatus, StructuredRequirements } from '@/lib/types/chat';

type PipelineStatus = 'idle' | 'clarifying' | 'running' | 'paused' | 'done';

interface PipelineState {
  tasks: PipelineTask[];
  pipelineStatus: PipelineStatus;
  currentStep: PipelineStep | null;
  abortController: AbortController | null;
  requirements: StructuredRequirements | null;
}

interface PipelineActions {
  initTasks: () => void;
  updateTaskStatus: (step: PipelineStep, status: PipelineTaskStatus) => void;
  setPipelineStatus: (status: PipelineStatus) => void;
  setCurrentStep: (step: PipelineStep | null) => void;
  setAbortController: (controller: AbortController | null) => void;
  setRequirements: (req: StructuredRequirements) => void;
  reset: () => void;
}

const DEFAULT_TASKS: PipelineTask[] = [
  { id: 'clarification', step: 'clarification', label: '需求澄清', status: 'pending' },
  { id: 'script', step: 'script', label: '台本生成', status: 'pending' },
  { id: 'characters', step: 'characters', label: '角色提取', status: 'pending' },
  { id: 'locations', step: 'locations', label: '场景提取', status: 'pending' },
  { id: 'storyboard', step: 'storyboard', label: '分镜生成', status: 'pending' },
];

const initialState: PipelineState = {
  tasks: [],
  pipelineStatus: 'idle',
  currentStep: null,
  abortController: null,
  requirements: null,
};

export const usePipelineStore = create<PipelineState & PipelineActions>((set) => ({
  ...initialState,

  initTasks: () =>
    set({
      tasks: DEFAULT_TASKS.map((t) => ({ ...t, status: 'pending' })),
      pipelineStatus: 'clarifying',
      currentStep: 'clarification',
    }),

  updateTaskStatus: (step, status) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.step === step ? { ...t, status } : t
      ),
    })),

  setPipelineStatus: (status) => set({ pipelineStatus: status }),

  setCurrentStep: (step) => set({ currentStep: step }),

  setAbortController: (controller) => set({ abortController: controller }),

  setRequirements: (req) => set({ requirements: req }),

  reset: () => {
    set((state) => {
      state.abortController?.abort();
      return { ...initialState };
    });
  },
}));
